import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import * as lambda from "aws-lambda";
import { S3Utils } from "./shared/s3";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");

const s3Utils = new S3Utils(region);
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const SIGNED_URL_DURATION_SECONDS = 60;

export const handler = Sentry.AWSLambda.wrapHandler(
  async (event: lambda.APIGatewayRequestAuthorizerEvent) => {
    const fileName = event.queryStringParameters?.fileName;

    if (fileName) {
      const url = await s3Utils.s3.getSignedUrl("getObject", {
        Bucket: bucketName,
        Key: fileName,
        Expires: SIGNED_URL_DURATION_SECONDS,
      });

      const response = {
        statusCode: 301,
        headers: {
          Location: url,
        },
      };

      return response;
    }
  }
);
