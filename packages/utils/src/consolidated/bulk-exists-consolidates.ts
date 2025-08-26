import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createConsolidatedDataFilePath } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { initFile } from "../shared/file";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script checks if consolidated data exists for a list of patients.
 * It saves the results to files in the `runs/exists-consolidated` folder:
 * - <cx-name>_<timestamp>_exists.txt: Patient IDs for which consolidated bundle exists
 * - <cx-name>_<timestamp>_missing.txt: Patient IDs for which consolidated bundle does not exist
 *
 * Execute this with:
 * $ ts-node src/consolidated/bulk-exists-consolidates.ts
 */

// Add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line
const fileName = "";

const numberOfParallelExecutions = 30;

const cxId = getEnvVarOrFail("CX_ID");
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

// query stuff
const confirmationTime = dayjs.duration(10, "seconds");

// output stuff
const getOutputFileName = buildGetDirPathInside(`exists-consolidated`);

async function main() {
  initRunsFolder();
  const { log } = out("");

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const fileContents = getFileContents(fileName);
      patientIds.push(...fileContents.split("\n"));
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  if (patientIds.length === 0) {
    log(">>> No patient IDs provided. Please add patient IDs to the patientIds array.");
    process.exit(1);
  }

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}with ${patientIds.length} patient IDs...`);

  const { orgName } = await getCxData(cxId, undefined, false);
  await displayWarningAndConfirmation(patientIds.length, orgName, log);

  const existsFileName = getOutputFileName(orgName);
  initFile(existsFileName);

  log(`>>> Running it...`);
  let ptIndex = 0;
  await executeAsynchronously(
    patientIds,
    async patientId => {
      await doesConsolidateExists(patientId, cxId, existsFileName, log);
      log(`>>> Progress: ${++ptIndex}/${patientIds.length} patients complete`);
    },
    { numberOfParallelExecutions, minJitterMillis: 5, maxJitterMillis: 100 }
  );
  log(
    `>>> Done checking consolidated data for ${patientIds.length} patients in ${elapsedTimeAsStr(
      startedAt
    )}`
  );
  process.exit(0);
}

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  orgName: string,
  log: typeof console.log
) {
  const msg = `You are about to check if consolidated bundle exists for ${patientCount} patients of the org/cx ${orgName}.`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function doesConsolidateExists(
  patientId: string,
  cxId: string,
  existsFileName: string,
  log: typeof console.log
) {
  try {
    const fileKey = createConsolidatedDataFilePath(cxId, patientId);
    const exists = await s3Utils.fileExists(medicalDocsBucketName, fileKey);

    if (exists) {
      log(`">>> Consolidated data exists for patient ${patientId}...`);
      fs.appendFileSync(existsFileName + "_exists.txt", `${patientId}\n`);
    } else {
      log(`    Consolidated data does not exist for patient ${patientId}... <<<<`);
      fs.appendFileSync(existsFileName + "_missing.txt", `${patientId}\n`);
    }
  } catch (error) {
    const msg = `ERROR processing patient ${patientId}: `;
    log(`${msg}${errorToString(error)}`);
  }
}

main();
