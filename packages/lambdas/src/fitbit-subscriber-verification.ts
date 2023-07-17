import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import { Request } from "express";
import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const fitbitClientSecretName = getEnvOrFail("FITBIT_CLIENT_SECRET");
const fitbitSubscriberVerificationCode = getEnvOrFail("FITBIT_SUBSCRIBER_VERIFICATION_CODE");

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

export const handler = Sentry.AWSLambda.wrapHandler(async (req: Request) => {
  console.log(`Verifying at least one UserAuthToken on body...`);

  const secret: string = (await getSecret(fitbitClientSecretName)) as string;
  if (!secret) {
    throw new Error(`Config error - FITBIT_CLIENT_SECRET doesn't exist`);
  }

  const verificationCode: string = (await getSecret(fitbitSubscriberVerificationCode)) as string;
  if (!verificationCode) {
    throw new Error(`Config error - FITBIT_SUBSCRIBER_VERIFICATION_CODE doesn't exist`);
  }

  if (req.query.verify) {
    console.log(
      "Verifying the subscriber. Make sure to use the verification code provided in the dev.fitbit dashboard!"
    );

    if (req.query.verify === fitbitSubscriberVerificationCode) {
      console.log("Received correct verification code.");
      return buildResponse(status.NO_CONTENT);
    } else {
      console.log("Incorrect verification code detected!");
      return buildResponse(status.NOT_FOUND);
    }
  }

  capture.message("Fitbit subscriber verification fail", {
    extra: { context: "webhook.fitbit.subscriber-verification" },
  });
  return buildResponse(status.NOT_FOUND);
});
