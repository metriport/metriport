import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { createConsolidatedDataFileNameWithSuffix } from "@metriport/core/domain/consolidated/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { checkBundle } from "@metriport/core/external/fhir/bundle/qa";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * This script checks a patient's consolidated data using the checkBundle() function
 * from packages/core.
 *
 * Either set the bundleFilePath or the cxId and patientId.
 *
 * Execute this with:
 * $ ts-node src/consolidated/check-patient-consolidated.ts
 */

// If set, the script will use the bundle file in the given path instead of downloading it from S3.
const bundleFilePath: string | undefined = undefined;
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

  const startedAt = Date.now();
  log(`>>> Starting...`);

  const fileKey = createConsolidatedDataFileNameWithSuffix(cxId, patientId) + ".json";

  log(`>>> Using bucket ${medicalDocsBucketName}`);
  log(`>>> Getting contents from ${fileKey}...`);
  const contents = bundleFilePath
    ? getFileContents(bundleFilePath)
    : await s3Utils.getFileContentsAsString(medicalDocsBucketName, fileKey);
  const bundle = JSON.parse(contents) as Bundle;

  try {
    log(`>>> Checking bundle...`);
    checkBundle(bundle, cxId, patientId);
  } catch (error) {
    log(`>>> Error: ${error}`);
    process.exit(1);
  }

  const ellapsed = Date.now() - startedAt;
  log(`>>> Done in ${ellapsed} ms`);
  process.exit(0);
}

main();
