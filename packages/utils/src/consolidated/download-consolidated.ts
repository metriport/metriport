import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { makeDirIfNeeded } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import fs from "fs";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";
import { initFile } from "../shared/file";
import { shouldStopScript } from "../shared/flow";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getIdsFromFile } from "../shared/ids";

/**
 * This script downloads consolidated bundles from S3 to the local filesystem.
 * Used for debuging purposes only, not to be used in production.
 *
 * Set the list of patientIds and the env vars to use.
 *
 * If you have a file with patient IDs, you can use that instead of the patientIds array.
 * Just set the fileName variable to the path of the file. The file should have one patient
 * ID per line, they can have quotes or not, and they can end with comma or not, as well
 * as any lines with "id" or "ID" will be skipped (this is so we use exports from DBeaver without
 * having to touch the file).
 *
 * If you have a path to a folder with existing consolidated bundles (e.g., from a previous run),
 * you can set the existingFilesPath variable to the path of the folder. Patients found in this
 * folder will be skipped.
 *
 * Execute this with:
 * $ ts-node src/consolidated/download-consolidated.ts
 */

const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line
const fileName = "";

const existingFilesPath = "";

const cxId = getEnvVarOrFail("CX_ID");
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

// This has been tested with 200 and it worked fine, but S3 might need to be warmed up first.
const numberOfParallelDownloads = 100;

const getOutputFileName = buildGetDirPathInside(`consolidated-bundles`);

async function main() {
  await sleep(100);
  initRunsFolder();
  const { log } = out("");

  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const idsFromFile = getIdsFromFile(fileName);
      patientIds.push(...idsFromFile);
      if (patientIds.length < 1) {
        log(`>>> Empty file ${fileName}, exiting...`);
        process.exit(1);
      }
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  await displayWarningAndConfirmation(cxId, patientIds.length, log);

  log(`>>> Using bucket ${medicalDocsBucketName}`);
  const outputDir = getOutputFileName(cxId);
  makeDirIfNeeded(outputDir);

  const failuresFilePath = `${outputDir}/_failures.csv`;
  initFile(failuresFilePath, "patientId,reason\n");

  const startedAt = buildDayjs().valueOf();
  let index = 0;
  let stopProcessing = false;
  await executeAsynchronously(
    patientIds,
    async patientId => {
      if (stopProcessing) return;
      if (shouldStopScript()) {
        stopProcessing = true;
        return;
      }
      await downloadSingleConsolidated(cxId, patientId, outputDir, failuresFilePath, log);
      index++;
      if (index % 50 === 0) {
        log(`>>> Progress: ${index} patients complete in ${elapsedTimeAsStr(startedAt)}`);
      }
    },
    { numberOfParallelExecutions: numberOfParallelDownloads }
  );

  if (stopProcessing) {
    log(
      `>>> Script stopped after ${index}/${patientIds.length} patients in ${elapsedTimeAsStr(
        startedAt
      )}`
    );
  } else {
    log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  }
  process.exit(0);
}

async function downloadSingleConsolidated(
  cxId: string,
  patientId: string,
  outputDir: string,
  failuresFilePath: string,
  log: typeof console.log
) {
  if (existingFilesPath.length > 0) {
    const existingFilePath = `${existingFilesPath}/${patientId}_CONSOLIDATED_DATA.json`;
    if (fs.existsSync(existingFilePath)) {
      log(`>>> Skipping ${patientId} - already downloaded`);
      return;
    }
  }

  try {
    const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";
    const contents = await s3Utils.getFileContentsAsStringV3({
      bucketName: medicalDocsBucketName,
      key: fileKey,
    });
    const filePath = `${outputDir}/${patientId}_CONSOLIDATED_DATA.json`;
    makeDirIfNeeded(filePath);
    fs.writeFileSync(filePath, contents, "utf8");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const reason = error.message;
    log(`>>> Error to download consolidated bundle for patient ${patientId}: ${reason}`);
    fs.appendFileSync(failuresFilePath, `${patientId},"${reason?.replace(/"/g, '""')}"\n`);
  }
}

async function displayWarningAndConfirmation(
  cxId: string,
  patientCount: number | undefined,
  log: typeof console.log
) {
  const msg = `You are about to download consolidated bundles for ${patientCount} patients of the cx ${cxId}.`;
  await confirm(msg, log);
}

main();
