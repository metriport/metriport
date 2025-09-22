import { makeS3Client } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeDir, makeDirIfNeeded, writeFileContents } from "../shared/fs";

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
  const s3 = makeS3Client(region);

  for (const fileName of inputFileNamesToDownload) {
    console.log(`Getting file ${fileName}...`);
    const obj = await s3.getObject({ Bucket: inputBucketName, Key: fileName }).promise();

    if (obj.Body) {
      const content = obj.Body.toString();

      const destFileName = `${outputFolderName}/${fileName}`;
      makeDirIfNeeded(destFileName);
      writeFileContents(destFileName, content);
    }
  }
}

main();
