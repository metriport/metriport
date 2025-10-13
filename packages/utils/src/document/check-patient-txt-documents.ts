import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr } from "../shared/duration";
import { initFile } from "../shared/file";
import { buildGetDirPathInside } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";
import { getIdsFromFile } from "../shared/ids";

dayjs.extend(duration);

/**
 * Utility to check if TXT documents for patients contain the "<Clinical" string.
 *
 * Fetches all TXT documents for given patients from the medical documents bucket
 * and checks if they contain the specified string. Processes files in parallel.
 * Prints out a list of patient IDs that have documents containing "<Clinical".
 *
 * If a file is provided, it will read patient IDs from the file and use them instead of the
 * patientIds array.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to check - leave empty to run for all
 *   patients of the customer
 * - optionally, add a file with patient IDs to check
 * - run it
 *   - ts-node src/snowflake/check-patient-txt-documents.ts
 *   - ts-node src/snowflake/check-patient-txt-documents.ts <file-with-patient-ids>
 */

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

// If provided, will read patient IDs from the file and use them instead of the patientIds array
const fileName: string | undefined = process.argv[2];

const numberOfParallelExecutions = 10;
const confirmationTime = dayjs.duration(10, "seconds");

const csvHeader = "patientId,fileName,containsClinical,fileSize,error\n";
const getOutputFileName = buildGetDirPathInside(`snowflake/patient-txt-documents-check`);

interface TxtDocumentCheckResult {
  patientId: string;
  fileName: string;
  containsClinical: boolean;
  fileSize: number;
  error?: string;
}

const region = getEnvVarOrFail("AWS_REGION");
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create({ baseURL: apiUrl });

export function createS3Client(): S3Utils {
  return new S3Utils(region);
}

async function listTxtDocumentsForPatient({
  s3Client,
  patientId,
  cxId,
}: {
  s3Client: S3Utils;
  patientId: string;
  cxId: string;
}): Promise<string[]> {
  try {
    const medicalDocumentsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

    // List all objects with the patient ID prefix (first level only)
    const prefix = `${cxId}/${patientId}/`;
    const objects = await s3Client.listObjects(medicalDocumentsBucketName, prefix);

    // Filter for TXT files only (first level, no subfolders)
    const txtFiles = objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((obj: any) => {
        if (!obj.Key || !obj.Key.toLowerCase().endsWith(".txt")) {
          return false;
        }
        // Only include files that are directly under the patient folder (no subfolders)
        // The prefix is `${cxId}/${patientId}/`, so the rest should not contain another '/'
        const prefix = `${cxId}/${patientId}/`;
        const rest = obj.Key.slice(prefix.length);
        return rest.length > 0 && !rest.includes("/");
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((obj: any) => obj.Key);

    return txtFiles;
  } catch (error) {
    console.error(`Error listing TXT documents for patient ${patientId}:`, error);
    return [];
  }
}

async function checkTxtDocument({
  s3Client,
  patientId,
  fileName,
}: {
  s3Client: S3Utils;
  patientId: string;
  fileName: string;
}): Promise<TxtDocumentCheckResult> {
  try {
    const medicalDocumentsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

    // Get file content as string (not downloaded to disk)
    const contentString = await s3Client.getFileContentsAsString(
      medicalDocumentsBucketName,
      fileName
    );

    const containsClinical = contentString.includes("<Clinical");
    const fileSize = contentString.length;

    return {
      patientId,
      fileName,
      containsClinical,
      fileSize,
    };
  } catch (error) {
    return {
      patientId,
      fileName,
      containsClinical: false,
      fileSize: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function processPatientTxtDocuments({
  s3Client,
  patientId,
  cxId,
}: {
  s3Client: S3Utils;
  patientId: string;
  cxId: string;
}): Promise<TxtDocumentCheckResult[]> {
  const results: TxtDocumentCheckResult[] = [];

  try {
    // List all TXT documents for the patient
    const txtFiles = await listTxtDocumentsForPatient({ s3Client, patientId, cxId });

    if (txtFiles.length === 0) {
      return results;
    }

    // Process each TXT file
    await executeAsynchronously(
      txtFiles,
      async fileName => {
        const result = await checkTxtDocument({ s3Client, patientId, fileName });
        results.push(result);
      },
      {
        numberOfParallelExecutions: 5, // Lower for individual patient processing
        minJitterMillis: 10,
        maxJitterMillis: 100,
      }
    );
  } catch (error) {
    results.push({
      patientId,
      fileName: "unknown",
      containsClinical: false,
      fileSize: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return results;
}

async function displayWarningAndConfirmation(
  patientsToProcess: string[],
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to check TXT documents for ${patientsToProcess.length} patients of ` +
    `customer ${orgName} (${cxId}) for the "<Clinical" string, are you sure?${allPatientsMsg}`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

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
  const patientsToProcess = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToProcess)];

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, orgName, log);
  log(`>>> Running it... ${uniquePatientIds.length} patients`);

  const s3Client = createS3Client();
  const allResults: TxtDocumentCheckResult[] = [];

  const outputFileName = getOutputFileName(orgName) + ".csv";
  const containsClinicalFileName = getOutputFileName(orgName) + "_contains_clinical.csv";
  const noClinicalFileName = getOutputFileName(orgName) + "_no_clinical.csv";
  const failedFileName = getOutputFileName(orgName) + "_failed.csv";

  initFile(outputFileName, csvHeader);
  initFile(containsClinicalFileName, csvHeader);
  initFile(noClinicalFileName, csvHeader);
  initFile(failedFileName, csvHeader);

  let amountOfPatientsProcessed = 0;
  const failedPatientIds: string[] = [];

  await executeAsynchronously(
    uniquePatientIds,
    async patientId => {
      try {
        const patientResults = await processPatientTxtDocuments({ s3Client, patientId, cxId });
        allResults.push(...patientResults);

        amountOfPatientsProcessed++;
        if (amountOfPatientsProcessed % 10 === 0) {
          log(`>>> Processed ${amountOfPatientsProcessed}/${uniquePatientIds.length} patients`);
        }
      } catch (error) {
        log(
          `Failed to process patient ${patientId} - reason: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        failedPatientIds.push(patientId);
      }
    },
    { numberOfParallelExecutions, minJitterMillis: 10, maxJitterMillis: 200 }
  );

  // Write results to files
  for (const result of allResults) {
    const csvRow = `${result.patientId},${result.fileName},${result.containsClinical},${
      result.fileSize
    },${result.error || ""}\n`;

    fs.appendFileSync(outputFileName, csvRow);

    if (result.error) {
      fs.appendFileSync(failedFileName, csvRow);
    } else if (result.containsClinical) {
      fs.appendFileSync(containsClinicalFileName, csvRow);
    } else {
      fs.appendFileSync(noClinicalFileName, csvRow);
    }
  }

  const containsClinicalFiles = allResults.filter(r => r.containsClinical && !r.error);
  const noClinicalFiles = allResults.filter(r => !r.containsClinical && !r.error);
  const failed = allResults.filter(r => r.error);

  const totalFileSize = allResults.reduce((sum, r) => sum + r.fileSize, 0);
  const avgFileSize = allResults.length > 0 ? Math.round(totalFileSize / allResults.length) : 0;

  // Get unique patient IDs that have documents containing "<Clinical"
  const patientsWithClinicalDocs = [...new Set(containsClinicalFiles.map(r => r.patientId))];

  log(``);
  if (failedPatientIds.length > 0) {
    const outputFile =
      "check-patient-txt-documents_failed-patient-ids_" +
      buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-") +
      ".txt";
    log(`>>> FAILED to process ${failedPatientIds.length} patients - see ${outputFile}`);
    fs.writeFileSync(outputFile, failedPatientIds.join("\n"));
  }

  log(`\n=== RESULTS ===`);
  log(`Total patients processed: ${amountOfPatientsProcessed}`);
  log(`Total TXT documents found: ${allResults.length}`);
  log(`Documents containing '<Clinical': ${containsClinicalFiles.length}`);
  log(`Documents NOT containing '<Clinical': ${noClinicalFiles.length}`);
  log(`Failed to process: ${failed.length}`);
  log(`Total file size: ${totalFileSize} characters`);
  log(`Average file size: ${avgFileSize} characters`);

  log(`\n=== PATIENT IDs WITH CLINICAL DOCUMENTS ===`);
  log(`Patients with documents containing '<Clinical': ${patientsWithClinicalDocs.length}`);
  if (patientsWithClinicalDocs.length > 0) {
    log(`Patient IDs:`);
    patientsWithClinicalDocs.forEach(patientId => {
      log(`  ${patientId}`);
    });

    // Also save to file
    const clinicalPatientsFile = getOutputFileName(orgName) + "_patients_with_clinical.txt";
    fs.writeFileSync(clinicalPatientsFile, patientsWithClinicalDocs.join("\n"));
    log(`\nPatient IDs saved to: ${clinicalPatientsFile}`);
  }

  log(`\n=== OUTPUT FILES ===`);
  log(`All results: ${outputFileName}`);
  log(`Documents containing '<Clinical': ${containsClinicalFileName}`);
  log(`Documents NOT containing '<Clinical': ${noClinicalFileName}`);
  log(`Failed documents: ${failedFileName}`);

  log(`\n>>> ALL processed in ${elapsedTimeAsStr(startedAt)}`);
}

main().catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
