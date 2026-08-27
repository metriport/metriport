import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { documentUploaderHandler } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { buildDayjs } from "@metriport/shared/common/date";
import { Command } from "commander";
import { confirm } from "../shared/confirm";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * Script to trigger the post-processing of an uploaded document.
 * It will run the document uploader handler so you can test/debug the upload flow.
 *
 * The reason is that we have a trigger on S3 that runs a lambda when the doc is uploaded.
 * This doesn't happen when you run it on local - in fact, staging probably had an error after
 * you uploaded the file, since the document doesn't exist there.
 *
 * Usage:
 * - make sure the .env file is set up correctly with the env vars below
 * - run it with:
 *   ts-node src/document/document-upload-post-process.ts -sk <source-key>
 * - provide source bucket and destination bucket if you want to use different ones than the defaults)
 */

const region = getEnvVarOrFail("AWS_REGION");
const apiUrl = getEnvVarOrFail("API_URL");

const defaultSourceBucket = "metriport-medical-document-uploads-staging";
const defaultDestinationBucket = "medical-documents-staging";

const program = new Command();
program
  .name("document-upload-post-process")
  .description("CLI to trigger the post-processing of an uploaded document")
  .option("-sb, --source-bucket <bucket>", "Source S3 bucket name", defaultSourceBucket)
  .requiredOption("-sk, --source-key <key>", "Source S3 object key")
  .option(
    "-db, --destination-bucket <bucket>",
    "Destination S3 bucket name",
    defaultDestinationBucket
  )
  .showHelpAfterError()
  .action(main);

async function main({
  sourceBucket,
  sourceKey,
  destinationBucket,
}: {
  sourceBucket: string;
  sourceKey: string;
  destinationBucket: string;
}) {
  const s3Utils = new S3Utils(region);
  const fileInfo = await s3Utils.getFileInfoFromS3(sourceKey, sourceBucket);

  if (!fileInfo.exists) {
    console.log(`File not found at s3://${sourceBucket}/${sourceKey}`);
    process.exit(1);
  }

  const fileSizeKb = (fileInfo.sizeInBytes / 1024).toFixed(2);
  const uploadTime = fileInfo.updatedAt?.toISOString() ?? "unknown";

  const confirmationMsg =
    `About to post-process document:\n` +
    `  Source key:         s3://${sourceBucket}/${sourceKey}\n` +
    `  Destination bucket: s3://${destinationBucket}\n` +
    `  File size:          ${fileSizeKb} KB\n` +
    `  Content type:       ${fileInfo.contentType}\n` +
    `  Upload time:        ${uploadTime}`;
  await confirm(confirmationMsg);

  const startedAt = Date.now();
  console.log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  try {
    const apiServerURL = `${apiUrl}/internal/docs/doc-ref`;
    await documentUploaderHandler(sourceBucket, sourceKey, destinationBucket, region, apiServerURL);
    console.log("Successfully post-processed the uploaded file.");
  } catch (err) {
    console.log(`Error running with file ${sourceKey}:`, err);
  } finally {
    console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  }
}

program.parse();

export default program;
