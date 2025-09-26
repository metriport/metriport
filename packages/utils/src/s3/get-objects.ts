import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeDir, makeDirIfNeeded, writeFileContents } from "../shared/fs";
import { errorToString } from "@metriport/shared";

/**
 * Get files from S3 and store them locally.
 *
 * Set:
 * - outputFolderName: the folder where the files will be stored;
 * - inputFileNamesToDownload: the list of files to download;
 * - env vars
 */

const outputFolderName = ``;
const inputFileNamesToDownload: string[] = [];

const inputBucketName = getEnvVarOrFail("MEDICAL_DOCS_S3_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

async function main() {
  makeDir(outputFolderName);
  const s3 = new S3Utils(region);

  for (const fileName of inputFileNamesToDownload) {
    try {
      console.log(`Getting file ${fileName}...`);
      const content = await s3.getFileContentsAsString(inputBucketName, fileName);
      if (content) {
        const destFileName = `${outputFolderName}/${fileName}`;
        makeDirIfNeeded(destFileName);
        writeFileContents(destFileName, content);
      }
    } catch (error) {
      console.error(`Error getting file ${fileName}: ${errorToString(error)}`);
    }
  }
}

main();
