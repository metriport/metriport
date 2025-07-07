import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { addMissingReferences } from "@metriport/core/command/consolidated/consolidated-filter";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { initTimer } from "@metriport/shared/common/timer";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script adds missing references to a patient's consolidated data using the addMissingReferences() function
 * from packages/core.
 *
 * Either set the bundleFilePath or the cxId and patientId.
 *
 * Execute this with:
 * $ ts-node src/consolidated/add-missing-references-consolidated.ts
 */

// If set, the script will use the bundle file in the given path instead of downloading it from S3.
const bundleFilePath: string | undefined = "";

// If the bundle file path is not set, the script will download the consolidated data from S3 using this props
const cxId = "";
const patientId = "";

const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

async function main() {
  await sleep(100);
  initRunsFolder();
  const { log } = out("");

  log(`>>> Starting...`);

  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";

  log(`>>> Using bucket ${medicalDocsBucketName}`);
  log(`>>> Getting contents from ${fileKey}...`);
  const contents = bundleFilePath
    ? getFileContents(bundleFilePath)
    : await s3Utils.getFileContentsAsString(medicalDocsBucketName, fileKey);

  const bundle = JSON.parse(contents) as Bundle;

  try {
    log(`>>> Adding missing references...`);
    const timer = initTimer();
    addMissingReferences(bundle, bundle, addMissingReferences);
    log(`>>> Finished addMissingReferences() in ${timer.getElapsedTime()} ms`);
  } catch (error) {
    log(`>>> Error: ${error}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
