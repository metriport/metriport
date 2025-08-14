// 1-fhir-to-csv.ts
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { SQSClient } from "@metriport/core/external/aws/sqs";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import fs from "fs";
import duration from "dayjs/plugin/duration";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";
import { buildDayjs } from "@metriport/shared/common/date";

dayjs.extend(duration);

/**
 * This script triggers the conversion of patients' consolidated data from JSON format to CSV.
 * It sends a message to SQS per patient, consumed by a Lambda function that generates the
 * CSV file.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to convert - leave empty to run for all
 *   patients of the customer
 * - run `ts-node src/analytics-platform/1-fhir-to-csv.ts`
 */

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

const numberOfParallelExecutions = 30;
const confirmationTime = dayjs.duration(10, "seconds");

const fhirToCsvJobId = "F2C_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const queueUrl = getEnvVarOrFail("FHIR_TO_CSV_QUEUE_URL");
const region = getEnvVarOrFail("AWS_REGION");

const sqsClient = new SQSClient({ region });
const api = axios.create({ baseURL: apiUrl });

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);
  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  const patientsToInsert = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToInsert)];

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(`>>> Running it... fhirToCsvJobId: ${fhirToCsvJobId}`);

  let amountOfPatientsProcessed = 0;

  const failedPatientIds: string[] = [];
  await executeAsynchronously(
    uniquePatientIds,
    async patientId => {
      const payload = JSON.stringify({
        jobId: fhirToCsvJobId,
        cxId,
        patientId,
      });
      try {
        await sqsClient.sendMessageToQueue(queueUrl, payload, {
          fifo: true,
          messageDeduplicationId: patientId,
          messageGroupId: patientId,
        });
        amountOfPatientsProcessed++;
        if (amountOfPatientsProcessed % 100 === 0) {
          log(`>>> Sent ${amountOfPatientsProcessed}/${uniquePatientIds.length} patients to queue`);
        }
      } catch (error) {
        log(
          `Failed to put message on queue for patient ${patientId} - reason: ${errorToString(
            error
          )}`
        );
        failedPatientIds.push(patientId);
      }
    },
    { numberOfParallelExecutions, minJitterMillis: 10, maxJitterMillis: 100 }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    const outputFile = "1-fhir-to-csv_failed-patient-ids_" + fhirToCsvJobId + ".txt";
    log(`>>> FAILED to send messages for ${failedPatientIds.length} patients - see ${outputFile}`);
    fs.writeFileSync(outputFile, failedPatientIds.join("\n"));
  }

  log(`>>> ALL Done (${amountOfPatientsProcessed} patients) in ${elapsedTimeAsStr(startedAt)}`);
  log(`- fhirToCsvJobId: ${fhirToCsvJobId}`);
}

async function displayWarningAndConfirmation(
  patientsToInsert: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to trigger the conversion of ${patientsToInsert.length} patients of ` +
    `customer ${orgName} (${cxId}) from JSON to CSV, are you sure?${allPatientsMsg}`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

main();
