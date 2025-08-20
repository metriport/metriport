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
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script downloads consolidated bundles from S3 to the local filesystem.
 * Used for debuging purposes only, not to be used in production.
 *
 * Set the cxId and list of patientIds.
 *
 * Execute this with:
 * $ ts-node src/consolidated/download-consolidated.ts
 */

const patientIds: string[] = [];

const cxId = getEnvVarOrFail("CX_ID");
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);
const confirmationTime = dayjs.duration(10, "seconds");

const getOutputFileName = buildGetDirPathInside(`consolidated-bundles`);

async function main() {
  await sleep(100);
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  await displayWarningAndConfirmation(cxId, patientIds.length, log);

  log(`>>> Using bucket ${medicalDocsBucketName}`);
  const outputDir = getOutputFileName(cxId);
  makeDirIfNeeded(outputDir);

  await executeAsynchronously(
    patientIds,
    async patientId => {
      await downloadSingleConsolidated(cxId, patientId, outputDir, log);
    },
    { numberOfParallelExecutions: 20 }
  );

  log(`>>> Done in ${elapsedTimeAsStr(startedAt)}ms`);
  process.exit(0);
}

async function downloadSingleConsolidated(
  cxId: string,
  patientId: string,
  outputDir: string,
  log: typeof console.log
) {
  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";

  log(`>>> Getting contents from ${fileKey}...`);
  const contents = await s3Utils.getFileContentsAsString(medicalDocsBucketName, fileKey);

  try {
    log(`>>> Storing bundle...`);
    const filePath = `${outputDir}/${patientId}_CONSOLIDATED_DATA.json`;
    makeDirIfNeeded(filePath);
    fs.writeFileSync(filePath, contents, "utf8");
  } catch (error) {
    log(`>>> Error: ${error}`);
    process.exit(1);
  }
}

async function displayWarningAndConfirmation(
  cxId: string,
  patientCount: number | undefined,
  log: typeof console.log
) {
  const msg = `You are about to recreate consolidated data for ${patientCount} patients of the cx ${cxId}.`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

main();
