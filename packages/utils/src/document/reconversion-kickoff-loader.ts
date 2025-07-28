import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ReconversionKickoffParams } from "@metriport/core/command/reconversion/reconversion-kickoff-direct";
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { errorToString } from "@metriport/shared/common/error";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { JSONParser, ParsedElementInfo } from "@streamparser/json";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { groupBy, isEmpty } from "lodash";

dayjs.extend(duration);

/**
 * This script is used to kick off a reconversion for a specific list of patients, and for a specific date range.
 * It will send a message to the reconversion kickoff queue for each patient chunk (recommended to be 10/chunk).
 *
 * The reconversion kickoff lambda will then pick up the message and ping the API to reconvert patient documents.
 *
 * The input file is generated using the following SQL command:
 * ```
 * SELECT patient_id, cx_id
 * FROM docref_mapping
 * WHERE created_at BETWEEN <dateFrom> AND <dateTo>;
 * ```
 * Once the query is executed, export the results to a JSON file. Then, remove the SQL query from the object, and
 * only leave the array of objects. Indicate the path to the file in the `fileName` variable.
 *
 * To run the script, execute:
 * - ts-node src/document/reconversion-kickoff-loader.ts
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

const fileName =
  "/Users/ramilgaripov/Desktop/metriport/full_stack/metriport/packages/utils/src/document/stagingReconversion.json";
const dateFrom = "2025-04-01"; // YYYY-MM-DD, with optional timestamp, e.g. 2025-07-10 12:00
const dateTo = ""; // YYYY-MM-DD, with optional timestamp, e.g. 2025-07-11 12:00

async function main() {
  if (isEmpty(fileName)) {
    throw new Error("fileName is required");
  }
  if (isEmpty(dateFrom)) {
    throw new Error("dateFrom is required");
  }

  const patients: Array<{ patient_id: string; cx_id: string }> = [];

  console.log("Loading patient data from file...");
  await loadDataFromLargeJsonFile(fileName, ({ value }) => {
    const patient = value as { patient_id: string; cx_id: string };
    patients.push(patient);
  });

  console.log(`Loaded ${patients.length} patients from file`);

  const patientsByCxId = groupBy(patients, "cx_id");

  const payloads: ReconversionKickoffParams[] = [];

  for (const [cxId, cxPatients] of Object.entries(patientsByCxId)) {
    console.log("cxId", cxId);

    const patientIds = Array.from(new Set(cxPatients.map(p => p.patient_id)));

    const cxPayloads = patientIds.map(patientId => {
      const payloadParams: ReconversionKickoffParams = {
        cxId,
        patientId,
        dateFrom,
        ...(dateTo && dateTo !== "" ? { dateTo } : {}),
      };
      return payloadParams;
    });
    payloads.push(...cxPayloads);
  }

  console.log(`Total unique payloads to send: ${payloads.length}`);

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
          console.log(`Progress: ${itemIndex + 1}/${payloads.length} messages sent`);
        }
      } catch (e) {
        console.error(`Error sending message ${itemIndex + 1}: ${errorToString(e)}`);

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
      log: console.log,
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
    console.log(`\nFailed payloads saved to: ${errorsFileName}`);
    console.log(`You can retry these ${failedPayloads.length} failed messages later.`);
  }

  console.log(`\nFinal results:`);
  console.log(`- Total messages processed: ${payloads.length}`);
  console.log(`- Successfully sent: ${totalSent}`);
  console.log(`- Errors: ${totalErrors}`);
  console.log(`- Success rate: ${((totalSent / payloads.length) * 100).toFixed(2)}%`);
}

/**
 * Loads data from a large JSON file using streaming to avoid memory issues
 */
async function loadDataFromLargeJsonFile(
  path: string,
  onValue: (value: ParsedElementInfo.ParsedElementInfo) => void
): Promise<void> {
  const parser = new JSONParser({ stringBufferSize: undefined, paths: ["$.*"] });
  parser.onValue = onValue;
  await new Promise((resolve, reject) => {
    const inputStream = fs.createReadStream(path, { encoding: "utf8" });
    inputStream.on("error", reject);
    parser.onError = reject;
    parser.onEnd = () => resolve(undefined);
    inputStream.on("data", chunk => parser.write(chunk));
    inputStream.on("end", () => parser.end());
  });
}

main();
