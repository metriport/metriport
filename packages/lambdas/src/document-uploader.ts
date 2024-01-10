import { documentUploaderHandler } from "@metriport/core/domain/lambda-logic/document-uploader";
import { S3Event } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const apiUrl = getEnvOrFail("API_URL");
const destinationBucket = getEnvOrFail("MEDICAL_DOCUMENTS_DESTINATION_BUCKET");
const region = getEnvOrFail("AWS_REGION");

export const handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const sourceBucket = record.s3.bucket.name;
    const sourceKey = decodeURIComponent(record.s3.object.key);
    console.log(
      "Running the document uploader handler with sourceBucket:",
      sourceBucket,
      "sourceKey:",
      sourceKey
    );
    const endpointUrl = apiUrl + "/internal/docs/doc-ref";
    try {
      const resp = await documentUploaderHandler(
        sourceBucket,
        sourceKey,
        destinationBucket,
        region,
        endpointUrl
      );
      if (resp) {
        capture.message(resp.message, {
          extra: {
            context: `documentUploaderHandler.fileTooLarge`,
            size: resp.size,
            destinationBucket,
            sourceKey,
          },
        });
      }
    } catch (error) {
      console.log("Error in documentUploaderHandler", error);
      capture.error(error, {
        extra: { context: `documentUploaderHandler`, sourceBucket, sourceKey, error },
      });
    }
  }
};
