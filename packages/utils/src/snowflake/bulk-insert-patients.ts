import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import axios from "axios";
import { chunk } from "lodash";
import { v4 as uuidv4 } from "uuid";
import { getAllPatientIds } from "../patient/get-ids";

const sqsClient = new SQSClient({ region: "us-west-2" });

const patientIds: string[] = [];

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const queueUrl = getEnvVarOrFail("FHIR_TO_CSV_QUEUE_URL");

const api = axios.create({ baseURL: apiUrl });

async function main() {
  const patientsToInsert =
    patientIds.length > 0 ? patientIds : await getAllPatientIds({ axios: api, cxId });
  const chunks = chunk(patientsToInsert, 200);
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async patientId => {
        const payload = JSON.stringify({
          jobId: uuidv4(),
          cxId,
          patientId,
        });
        sqsClient.sendMessageToQueue(queueUrl, payload, {
          fifo: true,
          messageDeduplicationId: createUuidFromText(payload),
          messageGroupId: patientId,
        });
      })
    );
    console.log(`Sent ${chunk.length} messages... sleeping for 10 seconds`);
    await sleep(10000);
  }
}

main();
