import { docContributionFileParam } from "@metriport/core/external/commonwell/document/document-contribution";
import { errorToString } from "@metriport/core/util/error/shared";
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
    try {
      console.log(`Received request w/ params: ${JSON.stringify(event.queryStringParameters)}`);

      const fileName = event.queryStringParameters?.[docContributionFileParam] ?? "";
      if (fileName.trim().length <= 0) {
        return sendResponse({
          statusCode: 400,
          body: "Missing fileName query parameter",
        });
      }
      console.log(`File name: ${fileName}`);

      const key = fileName.startsWith("/") ? fileName.slice(1) : fileName;
      if (!key || key.trim().length <= 0) {
        return sendResponse({
          statusCode: 400,
          body: "Invalid fileName query parameter",
        });
      }

      console.log(`Key: ${key}`);
      const url = s3Utils.s3.getSignedUrl("getObject", {
        Bucket: bucketName,
        Key: key,
        Expires: SIGNED_URL_DURATION_SECONDS,
      });
      return sendResponse({
        statusCode: 301,
        headers: {
          Location: url,
        },
        body: "",
      });
    } catch (error) {
      const msg = `Error processing DR from CW`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          queryParams: event.queryStringParameters,
          error,
        },
      });
      return sendResponse({
        statusCode: 500,
        body: "Internal Server Error",
      });
    }
  }
);

function sendResponse(response: lambda.APIGatewayProxyResult) {
  console.log(`Sending to CW: ${JSON.stringify(response)}`);
  return response;
}
