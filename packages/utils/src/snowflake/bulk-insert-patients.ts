import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script inserts patients into Snowflake, by sending messages to a SQS queue.
 * The queue is consumed by a Lambda function that generates CSV files and calls a
 * "transform" lambda.
 * That second lambda converts the CSV into a diff CSV file and send it to Snowflake.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to insert
 * - run `ts-node src/snowflake/bulk-insert-patients.ts`
 */

const patientIds: string[] = [];

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const queueUrl = getEnvVarOrFail("FHIR_TO_CSV_QUEUE_URL");

const numberOfParallelExecutions = 20;
const confirmationTime = dayjs.duration(10, "seconds");

const sqsClient = new SQSClient({ region: getEnvVarOrFail("AWS_REGION") });
const api = axios.create({ baseURL: apiUrl });

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const jobId = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");

  const isAllPatients = patientIds.length < 1;
  const patientsToInsert = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;

  await displayWarningAndConfirmation(patientsToInsert, isAllPatients, orgName, log);
  log(`>>> Running it... jobId: ${jobId}`);

  const failedPatientIds: string[] = [];
  await executeAsynchronously(
    patientsToInsert,
    async patientId => {
      const payload = JSON.stringify({
        jobId,
        cxId,
        patientId,
      });
      try {
        await sqsClient.sendMessageToQueue(queueUrl, payload, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(payload),
          messageGroupId: patientId,
        });
      } catch (error) {
        log(
          `Failed to put message on queue for patient ${patientId} - reason: ${errorToString(
            error
          )}`
        );
        failedPatientIds.push(patientId);
      }
    },
    { numberOfParallelExecutions, minJitterMillis: 100, maxJitterMillis: 200 }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    log(`>>> Failed to send messages for ${failedPatientIds.length} patients:`);
    log(failedPatientIds.join(`\n`));
  }

  log(`>>> ALL Done in ${elapsedTimeAsStr(startedAt)} - jobId: ${jobId}`);
}

async function displayWarningAndConfirmation(
  patientsToInsert: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to send ${patientsToInsert.length} patients of ` +
    `customer ${orgName} (${cxId}) to Snowflake, are you sure?${allPatientsMsg}`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

main();
