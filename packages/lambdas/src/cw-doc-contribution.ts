import { S3Utils } from "@metriport/core/external/aws/s3";
import { docContributionFileParam } from "@metriport/core/external/commonwell-v1/document/document-contribution";
import { retrieveDocumentForCommonWell } from "@metriport/core/external/commonwell/contribution/shared-document-retrieval";
import { out } from "@metriport/core/util/log";
import { errorToString } from "@metriport/shared";
import * as lambda from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");

const s3Utils = new S3Utils(region);
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

/**
 * This lambda is called by CommonWell as part of document retrieval - DR.
 *
 * It's called after document query - DQ - with the Document Reference's
 * attachment URL - which points to here.
 *
 * This lambda should be behind API GW's OAuth authorizer at all times.
 *
 * It will:
 * - receive the fileName query parameter;
 * - parse the filename to extract document ID and content type;
 * - retrieve the document content from S3;
 * - return a FHIR Binary resource with the document data.
 */
const { log } = out("cw-doc-contribution");
export const handler = capture.wrapHandler(
  async (event: lambda.APIGatewayRequestAuthorizerEvent) => {
    const startedAt = Date.now();
    try {
      log(`Received request w/ params: ${JSON.stringify(event.queryStringParameters)}`);

      const fileName = event.queryStringParameters?.[docContributionFileParam] ?? "";
      if (fileName.trim().length <= 0) {
        return sendResponse({
          statusCode: 400,
          body: "Missing fileName query parameter",
        });
      }

      const binary = await retrieveDocumentForCommonWell({
        fileName,
        s3Utils,
        bucketName,
      });

      return sendResponse({
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(binary),
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
    } finally {
      log(`Sent binary. Took ${Date.now() - startedAt}ms`);
    }
  }
);

function sendResponse(response: lambda.APIGatewayProxyResult) {
  log(`Sending to CW: ${JSON.stringify(response)}`);
  return response;
}
