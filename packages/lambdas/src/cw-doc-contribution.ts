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

/**
 * This lambda is called by CommonWell as part of document retrieval - DR.
 *
 * It's called after document query - DQ - with the Document Refeference's
 * attachment URL - which points to here.
 *
 * This lambda should be behind API GW's OAuth authorizer at all times.
 *
 * It will:
 * - receive the attachment URL;
 * - generate a signed URL for the file (60s expiration);
 * - returns a redirect to the signed URL.
 */
export const handler = Sentry.AWSLambda.wrapHandler(
  async (event: lambda.APIGatewayRequestAuthorizerEvent) => {
    const fileName = event.queryStringParameters?.[docContributionFileParam] ?? "";
    const key = fileName.startsWith("/") ? fileName.slice(1) : fileName;

    if (fileName) {
      const url = s3Utils.s3.getSignedUrl("getObject", {
        Bucket: bucketName,
        Key: key,
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
