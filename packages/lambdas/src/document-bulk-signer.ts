import * as Sentry from "@sentry/serverless";
import * as lambda from "aws-lambda";
import { getEnvOrFail } from "./shared/env";
import { getSignedUrls } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";

const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");

export const handler = Sentry.AWSLambda.wrapHandler(async (event: lambda.APIGatewayProxyEvent) => {
  const body = JSON.parse(event.body || "{}");
  const fileNames = body.fileNames;

  const urls: string[] = await getSignedUrls(fileNames, bucketName, region);
  const response = {
    statusCode: 200,
    body: JSON.stringify({ urls }),
  };

  return response;
});
