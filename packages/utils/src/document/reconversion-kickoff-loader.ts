import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ReconversionKickoffParams } from "@metriport/core/command/reconversion/reconversion-kickoff-direct";
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { errorToString } from "@metriport/shared/common/error";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { isEmpty } from "lodash";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";
import { getIdsFromLargeFile } from "../shared/ids";

dayjs.extend(duration);

/**
 * This script triggers the reconversion of patients' documents for a specific date range.
 * It sends a message to SQS per patient, consumed by a Lambda function that triggers
 * the reconversion process.
 *
 * If a file is provided, it will read patient IDs from the file and use them instead of the
 * patientIds array.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to reconvert - leave empty to run for all
 *   patients of the customer
 * - optionally, add a file with patient IDs to reconvert
 * - set dateFrom and dateTo for the date range
 * - run it
 *   - ts-node src/document/reconversion-kickoff-loader.ts
 *   - ts-node src/document/reconversion-kickoff-loader.ts <file-with-patient-ids>
 */

/**
 * This is a unique identifier for the reconversion kickoff job.
 * It is used to group messages in the SQS queue so that we can process them in order.
 *
 * Since we don't want to parallelize this work too much to avoid overloading the API,
 * all messages will be sent to the same job grouping.
 */
const RECONVESION_KICKOFF_JOB = "reconversion-kickoff-job";

const sqsClient = new SQSClient({ region: getEnvVarOrFail("AWS_REGION") });
const sqsUrl = getEnvVarOrFail("RECONVERSION_KICKOFF_QUEUE_URL");

/**
 * AWS SQS limit is 3000 messages/second, but we'll be safe and use 2000
 *
 * @see https://aws.amazon.com/sqs/faqs/#topic-3:~:text=What%20is%20the%20throughput%20quota%20for%20an%20Amazon%20SQS%20FIFO%20queue%3F
 */
const SQS_BATCH_SIZE = 2000;
const MIN_JITTER_BETWEEN_BATCHES = dayjs.duration(1, "seconds");
const confirmationTime = dayjs.duration(10, "seconds");

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

// If provided, will read patient IDs from the file and use them instead of the patientIds array
const fileName: string | undefined = process.argv[2];

const dateFrom = "1990-01-01"; // YYYY-MM-DD, with optional timestamp, e.g. 2025-07-10 12:00
const dateTo = ""; // YYYY-MM-DD, with optional timestamp, e.g. 2025-07-11 12:00

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create({ baseURL: apiUrl });

async function displayWarningAndConfirmation(
  patientsToInsert: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to trigger reconversion for ${patientsToInsert.length} patients of ` +
    `customer ${orgName} (${cxId}) from ${dateFrom}${
      dateTo ? ` to ${dateTo}` : ""
    }, are you sure?${allPatientsMsg}`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function main() {
  if (isEmpty(dateFrom)) {
    throw new Error("dateFrom is required");
  }

  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting reconversion kickoff at ${dayjs().toISOString()}...`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const idsFromFile = await getIdsFromLargeFile(fileName);
      if (idsFromFile.length < 1) {
        log(`>>> Empty file ${fileName}`);
        return;
      }
      patientIds.push(...idsFromFile);
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  const patientsToInsert = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToInsert)];

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(`>>> Running it... ${uniquePatientIds.length} patients for customer ${orgName} (${cxId})`);

  const payloads: ReconversionKickoffParams[] = uniquePatientIds.map(patientId => {
    const payloadParams: ReconversionKickoffParams = {
      cxId,
      patientId,
      dateFrom,
      ...(dateTo && dateTo !== "" ? { dateTo } : {}),
    };
    return payloadParams;
  });

  log(`>>> Total unique payloads to send: ${payloads.length}`);

  let totalSent = 0;
  let totalErrors = 0;
  const failedPayloads: Array<{
    payload: ReconversionKickoffParams;
    error: string;
    itemIndex: number;
  }> = [];

  await executeAsynchronously(
    payloads,
    async (payload, itemIndex) => {
      const payloadString = JSON.stringify(payload);
      try {
        // For debugging - write to file
        // fs.appendFile("sqsMessages.json", payloadString + "\n", "utf8", () => {});

        await sqsClient.sendMessageToQueue(sqsUrl, payloadString, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(payloadString),
          messageGroupId: RECONVESION_KICKOFF_JOB,
        });

        totalSent++;
        if (itemIndex % 1000 === 0) {
          log(`Progress: ${itemIndex + 1}/${payloads.length} messages sent`);
        }
      } catch (e) {
        log(`Error sending message ${itemIndex + 1}: ${errorToString(e)}`);

        failedPayloads.push({
          payload,
          error: errorToString(e),
          itemIndex,
        });
        totalErrors++;
      }
    },
    {
      numberOfParallelExecutions: SQS_BATCH_SIZE,
      minJitterMillis: MIN_JITTER_BETWEEN_BATCHES.asMilliseconds(),
      maxJitterMillis: MIN_JITTER_BETWEEN_BATCHES.asMilliseconds() * 1.5,
      keepExecutingOnError: true,
      log: log,
    }
  );

  // Save failed payloads to errors.json for later retry
  if (failedPayloads.length > 0) {
    const errorsFileName = `reconversion-kickoff-errors.json`;
    const failedPatients = failedPayloads.map(({ payload }) => ({
      patient_id: payload.patientId,
      cx_id: payload.cxId,
    }));

    fs.writeFileSync(errorsFileName, JSON.stringify(failedPatients, null, 2));
    log(`\nFailed payloads saved to: ${errorsFileName}`);
    log(`You can retry these ${failedPayloads.length} failed messages later.`);
  }

  log(``);
  log(`>>> ALL sent to queue (${totalSent} patients) in ${elapsedTimeAsStr(startedAt)}`);
  log(`\nFinal results:`);
  log(`- Total messages processed: ${payloads.length}`);
  log(`- Successfully sent: ${totalSent}`);
  log(`- Errors: ${totalErrors}`);
  log(`- Success rate: ${((totalSent / payloads.length) * 100).toFixed(2)}%`);
}

main();
