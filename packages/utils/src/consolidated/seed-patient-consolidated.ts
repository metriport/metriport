import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { createFilePath } from "@metriport/core/domain/filename";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { initRunsFolder } from "../shared/folder";
// import { isMimeTypeXML } from "@metriport/core/util/mime";

dayjs.extend(duration);

/**
 * This script copies the consolidated data of a patient from one customer to another, including the
 * conversion files used to build the consolidated data.
 *
 * Execute this with:
 * $ ts-node src/consolidated/seed-patient-consolidated.ts
 */

const sourceCxId = "";
const sourcePatientId = "";
const destinationCxId = "";
const destinationPatientId = "";

// Set this to true to save the JSON Bundlefiles to the local filesystem, pre and post ID replacement
const isDebugJsonBundles = false;

// STOP! Never point these to production buckets!
const medicalDocsBucketName = getEnvVarOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const conversionsBucketName = getEnvVarOrFail("CONVERSION_RESULT_BUCKET_NAME");

const confirmationTime = dayjs.duration(10, "seconds");
const region = getEnvVarOrFail("AWS_REGION");
const s3Utils = new S3Utils(region);

async function main() {
  await sleep(100);
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting...`);

  await displayWarningAndConfirmation(log);
  log(`>>> Running it...`);

  const sourceFilenamePrefix = createFilePath(sourceCxId, sourcePatientId, "");
  const destinationFilenamePrefix = createFilePath(destinationCxId, destinationPatientId, "");
  // const destinationPath = createFolderName(sourceCxId, sourcePatientId);

  async function copyData(bucketName: string) {
    console.log(`>>> Processing bucket ${bucketName}...`);
    const sourceFiles = await s3Utils.listObjects(bucketName, sourceFilenamePrefix);
    if (sourceFiles.length < 1) return;
    console.log(`... found ${sourceFiles.length} files to copy`);

    await executeAsynchronously(
      sourceFiles,
      async sourceFile => {
        const sourceFileKey = sourceFile.Key;
        if (!sourceFileKey) return;
        const destinationFileKey = sourceFileKey.replace(
          sourceFilenamePrefix,
          destinationFilenamePrefix
        );
        const info = await s3Utils.getFileInfoFromS3(sourceFileKey, bucketName);
        if (!info.exists) return;
        const fileType = info.contentType;
        if (!fileType) return;

        // if (isMimeTypeXML(fileType)) return;

        if (fileType === "application/json") {
          // load the file in memory, replace the patient IDs in the FHIR Bundle, store that at the destination
          const contents = await s3Utils.getFileContentsAsString(bucketName, sourceFileKey);
          const contentsWithIdReplaced = contents.replaceAll(sourcePatientId, destinationPatientId);

          if (isDebugJsonBundles) {
            fs.mkdirSync("files", { recursive: true });
            fs.writeFileSync("files/" + sourceFileKey.replaceAll("/", "___"), contents);
            fs.writeFileSync(
              "files/" + destinationFileKey.replaceAll("/", "___"),
              contentsWithIdReplaced
            );
          }

          await s3Utils.uploadFile({
            bucket: bucketName,
            key: destinationFileKey,
            file: Buffer.from(contentsWithIdReplaced),
            contentType: fileType,
          });
        } else {
          // just copy the file
          await s3Utils.copyFile({
            fromBucket: bucketName,
            fromKey: sourceFileKey,
            toBucket: bucketName,
            toKey: destinationFileKey,
          });
        }

        console.log(`... copied ${sourceFileKey} to ${destinationFileKey}`);
      },
      { numberOfParallelExecutions: 30 }
    );
  }

  await copyData(medicalDocsBucketName);
  await copyData(conversionsBucketName);

  const ellapsed = Date.now() - startedAt;
  log(`>>> Done copying the consolidated files in ${ellapsed} ms`);
  process.exit(0);
}

async function displayWarningAndConfirmation(log: typeof console.log) {
  const msg = `You are about to copy the consolidated data of patient ${sourcePatientId} to ${destinationPatientId}.`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

main();
