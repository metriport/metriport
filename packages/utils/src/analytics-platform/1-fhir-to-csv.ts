// 1-fhir-to-csv.ts
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { FhirToCsvCloud } from "@metriport/core/command/analytics-platform/fhir-to-csv/command/fhir-to-csv/fhir-to-csv-cloud";
import { buildFhirToCsvJobPrefix } from "@metriport/core/command/analytics-platform/fhir-to-csv/file-name";
import { createConsolidatedDataFilePath } from "@metriport/core/domain/consolidated/filename";
import { executeWithRetriesS3, S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { getCxData } from "../shared/get-cx-data";
import { getIdsFromFile } from "../shared/ids";

dayjs.extend(duration);

/**
 * This script triggers the conversion of patients' consolidated data from JSON format to CSV.
 * It sends a message to SQS per patient, consumed by a Lambda function that generates the
 * CSV file.
 *
 * If a file is provided, it will read patient IDs from the file and use them instead of the
 * patientIds array.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to convert - leave empty to run for all
 *   patients of the customer
 * - optionally, add a file with patient IDs to convert
 * - add --check-consolidated to check if the consolidated data exists in S3
 * - run it
 *   - ts-node src/analytics-platform/1-fhir-to-csv.ts
 *   - ts-node src/analytics-platform/1-fhir-to-csv.ts <file-with-patient-ids>
 *   - ts-node src/analytics-platform/1-fhir-to-csv.ts --check-consolidated
 */

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

// If provided, will read patient IDs from the file and use them instead of the patientIds array
const fileName: string | undefined = process.argv[2];

const checkConsolidatedExists = process.argv.includes("--check-consolidated");

const numberOfParallelExecutions = 30;
const confirmationTime = dayjs.duration(10, "seconds");
const fhirToCsvJobId = "F2C_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const s3Utils = new S3Utils(region);
const api = axios.create({ baseURL: apiUrl });

async function main() {
  await sleep(100);
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const idsFromFile = getIdsFromFile(fileName);
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

  let filtererdPatientIds: string[] = [];
  if (checkConsolidatedExists) {
    const localStartedAt = Date.now();
    log(
      `>>> Got ${uniquePatientIds.length} patients, checking consolidated data... (this may take a while)`
    );
    filtererdPatientIds = await getPatientsWithConsolidatedData({ patientIds: uniquePatientIds });
    log(
      `>>> Filtered down to ${filtererdPatientIds.length} patients in ${elapsedTimeAsStr(
        localStartedAt
      )}`
    );
  } else {
    filtererdPatientIds = uniquePatientIds;
  }

  await displayWarningAndConfirmation(filtererdPatientIds, isAllPatients, orgName, log);
  log(
    `>>> Running it... ${filtererdPatientIds.length} patients, fhirToCsvJobId: ${fhirToCsvJobId}`
  );

  let amountOfPatientsProcessed = 0;

  const fhirToCsvHandler = new FhirToCsvCloud();

  const failedPatientIds: string[] = [];
  await executeAsynchronously(
    filtererdPatientIds,
    async patientId => {
      try {
        await fhirToCsvHandler.processFhirToCsv({
          jobId: fhirToCsvJobId,
          cxId,
          patientId,
          outputPrefix: buildFhirToCsvJobPrefix({ cxId, jobId: fhirToCsvJobId }),
        });
        amountOfPatientsProcessed++;
        if (amountOfPatientsProcessed % 100 === 0) {
          log(
            `>>> Sent ${amountOfPatientsProcessed}/${filtererdPatientIds.length} patients to queue`
          );
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

  log(
    `>>> ALL sent to queue (${amountOfPatientsProcessed} patients) in ${elapsedTimeAsStr(
      startedAt
    )}`
  );
  log(`- fhirToCsvJobId: ${fhirToCsvJobId}`);
}

async function getPatientsWithConsolidatedData({ patientIds }: { patientIds: string[] }) {
  const ptsWithConsolidatedData: string[] = [];
  await executeAsynchronously(
    patientIds,
    async patientId => {
      try {
        const fileKey = createConsolidatedDataFilePath(cxId, patientId);
        const exists = await executeWithRetriesS3(
          () => s3Utils.fileExists(medicalDocsBucketName, fileKey),
          { maxAttempts: 5 }
        );
        if (exists) ptsWithConsolidatedData.push(patientId);
      } catch (error) {
        console.log(
          `Failed to check if consolidated data exists for patient ${patientId} - reason: ${errorToString(
            error
          )}`
        );
      }
    },
    { numberOfParallelExecutions: 100, minJitterMillis: 10, maxJitterMillis: 50 }
  );
  return ptsWithConsolidatedData;
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
