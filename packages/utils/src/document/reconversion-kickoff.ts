import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ReconversionKickoffParams } from "@metriport/core/command/reconversion/reconversion-kickoff-direct";
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { getEnvVarOrFail } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import fs from "fs";
import { chunk, groupBy } from "lodash";

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
 * Once the query is executed, export the results to a JSON file and indicate its path in the `fileName` variable.
 *
 * TODO: If you're expecting the number of messages to exceed 3,000, make sure we send them in chunks of <3,000 messages / second.
 * @see https://aws.amazon.com/sqs/faqs/#topic-3:~:text=What%20is%20the%20throughput%20quota%20for%20an%20Amazon%20SQS%20FIFO%20queue%3F
 */

const sqsClient = new SQSClient({ region: getEnvVarOrFail("AWS_REGION") });
const sqsUrl = getEnvVarOrFail("RECONVERSION_KICKOFF_QUEUE_URL");

const PATIENT_CHUNK_SIZE = 10;
const fileName = "";
const dateFrom = "";
const dateTo = "";

async function main() {
  const fileRaw = fs.readFileSync(fileName, "utf8");
  const patients = JSON.parse(fileRaw);
  const patientsByCxId = groupBy(patients, "cx_id");

  const payloads: ReconversionKickoffParams[] = [];

  for (const [cxId, cxPatients] of Object.entries(patientsByCxId)) {
    console.log("cxId", cxId);

    const patientIds = Array.from(new Set(cxPatients.map(p => p.patient_id)));

    const patientChunks = chunk(patientIds, PATIENT_CHUNK_SIZE);
    for (const [i, patients] of patientChunks.entries()) {
      console.log(`Chunk ${i + 1} of ${JSON.stringify(patients)}`);
      const payloadParams: ReconversionKickoffParams = {
        messageId: uuidv7(),
        cxId,
        patientIds: patients,
        dateFrom,
        ...(dateTo && dateTo !== "" ? { dateTo } : {}),
      };
      payloads.push(payloadParams);
    }
  }

  console.log("Loading the Queue");
  // TODO: Chunk this so we don't send more than 3000 messages at a time
  await Promise.all(
    payloads.map(p => {
      const payloadString = JSON.stringify(p);
      try {
        sqsClient.sendMessageToQueue(sqsUrl, payloadString, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(payloadString),
          messageGroupId: p.cxId,
        });
      } catch (e) {
        console.error(`Error sending message: ${e}`);
      }
    })
  );
  console.log(`Sent ${payloads.length} messages...`);
}

main();
