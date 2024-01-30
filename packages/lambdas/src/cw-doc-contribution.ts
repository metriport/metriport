import { docContributionFileParam } from "@metriport/core/external/commonwell/document/document-contribution";
import * as Sentry from "@sentry/serverless";
import * as lambda from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { S3Utils } from "./shared/s3";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");

const s3Utils = new S3Utils(region);
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const SIGNED_URL_DURATION_SECONDS = 60;

export const handler = Sentry.AWSLambda.wrapHandler(
  async (event: lambda.APIGatewayRequestAuthorizerEvent) => {
    const fileName = event.queryStringParameters?.[docContributionFileParam];

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

    return {
      statusCode: 400,
      body: "Missing fileName query parameter",
    };
  }
);
