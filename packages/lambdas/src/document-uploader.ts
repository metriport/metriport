import { documentUploaderHandler } from "@metriport/core/external/aws/lambda-logic/document-uploader";
import { S3Event } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const apiUrl = getEnvOrFail("API_URL");
const destinationBucket = getEnvOrFail("MEDICAL_DOCUMENTS_DESTINATION_BUCKET");
const region = getEnvOrFail("AWS_REGION");

export const handler = async (event: S3Event) => {
  if (event.Records[0]) {
    const sourceBucket = event.Records[0].s3.bucket.name;
    const sourceKey = decodeURIComponent(event.Records[0].s3.object.key);
    console.log(
      "Running the document uploader handler with sourceBucket:",
      sourceBucket,
      "sourceKey:",
      sourceKey
    );
    const endpointUrl = apiUrl + "/internal/docs/doc-ref";
    try {
      await documentUploaderHandler(
        sourceBucket,
        sourceKey,
        destinationBucket,
        region,
        endpointUrl
      );
    } catch (error) {
      console.log("Error in documentUploaderHandler", error);
      capture.error(error, {
        extra: { context: `documentUploaderHandler`, error },
      });
    }
  }
};
