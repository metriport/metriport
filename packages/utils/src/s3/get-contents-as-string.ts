import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { elapsedTimeAsStr } from "../shared/duration";
import { makeDir, makeDirIfNeeded, writeFileContents } from "../shared/fs";

/**
 * Read files from S3 as string and store them locally.
 *
 * Set:
 * - s3KeysToDownload: the list of files to read;
 * - env vars
 */

const s3KeysToDownload: string[] = [""];

const bucketName = getEnvVarOrFail("MEDICAL_DOCS_S3_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

const timestamp = buildDayjs().toISOString();
const outputBaseFolder = `runs/get-contents-as-string`;
const outputFolderName = `${outputBaseFolder}/${timestamp}`;

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  makeDir(outputFolderName);

  for (const s3Key of s3KeysToDownload) {
    console.log(`Getting file ${s3Key}...`);
    const outputFileNameFull = `./${outputFolderName}/${s3Key}`;

    const obj = await new S3Utils(region).getFileContentsAsString(bucketName, s3Key, "latin1");

    makeDirIfNeeded(outputFileNameFull);
    writeFileContents(outputFileNameFull, obj);
  }

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
