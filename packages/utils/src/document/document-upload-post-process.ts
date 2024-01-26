import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { documentUploaderHandler } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
const sourceBucket = getEnvVarOrFail("SOURCE_BUCKET");
const sourceKey = getEnvVarOrFail("SOURCE_KEY");
const destinationBucket = getEnvVarOrFail("DESTINATION_BUCKET");
const region = getEnvVarOrFail("AWS_REGION");
const apiUrl = getEnvVarOrFail("API_URL");

/**
This script takes a document from a source bucket and uploads it to a destination bucket, and generates a metadata xml file for the document
*/

async function main() {
  const apiServerURL = `${apiUrl}/internal/docs/doc-ref`;
  try {
    await documentUploaderHandler(sourceBucket, sourceKey, destinationBucket, region, apiServerURL);
    console.log("Successfully post-processed the uploaded file.");
  } catch (err) {
    console.log("Error post-processing the uploaded file:", err);
  }
}

main();
