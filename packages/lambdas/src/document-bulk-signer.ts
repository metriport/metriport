import * as Sentry from "@sentry/serverless";
import * as lambda from "aws-lambda";
import { S3Utils } from "./shared/s3";
import { getEnvOrFail } from "./shared/env";

const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");
const region = getEnvOrFail("AWS_REGION");
const SIGNED_URL_DURATION_SECONDS = 3600; // longer since a lot of docs

const s3Utils = new S3Utils(region);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: lambda.APIGatewayProxyEvent) => {
  const body = JSON.parse(event.body || "{}");
  const fileNames = body.fileNames;

  if (!Array.isArray(fileNames)) {
    return {
      statusCode: 400,
      body: "fileNames must be an array",
    };
  } else {
    const urls = await Promise.all(
      fileNames.map(async fileName => {
        return await s3Utils.s3.getSignedUrl("getObject", {
          Bucket: bucketName,
          Key: fileName,
          Expires: SIGNED_URL_DURATION_SECONDS,
        });
      })
    );

    const response = {
      statusCode: 200,
      body: JSON.stringify({ urls }),
    };

    return response;
  }
});
