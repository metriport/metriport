import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import { APIGatewayEvent } from "aws-lambda";
import status from "http-status";
import { getEnvOrFail } from "./shared/env";

const fitbitSubscriberVerificationCode = getEnvOrFail("FITBIT_SUBSCRIBER_VERIFICATION_CODE");

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayEvent) => {
  const verificationCode: string = (await getSecret(fitbitSubscriberVerificationCode)) as string;
  if (!verificationCode) {
    throw new Error(`Config error - FITBIT_SUBSCRIBER_VERIFICATION_CODE doesn't exist`);
  }

  if (event.queryStringParameters?.verify) {
    console.log(
      "Verifying the subscriber. Make sure to use the verification code provided in the dev.fitbit dashboard!"
    );

    if (event.queryStringParameters.verify === verificationCode) {
      console.log("Received correct verification code.");
      return buildResponse(status.NO_CONTENT);
    } else {
      console.log("Incorrect verification code detected!");
      return buildResponse(status.NOT_FOUND);
    }
  }

  return buildResponse(status.NOT_FOUND);
});
