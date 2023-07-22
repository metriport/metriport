import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { createHmac } from "crypto";
import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { APIGatewayEvent } from "aws-lambda";

// Keep this as early on the file as possible
capture.init();

const apiServerURL = getEnvOrFail("API_URL");
const fitbitClientSecretName = getEnvOrFail("FITBIT_CLIENT_SECRET");

const api = axios.create();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(status.NO_CONTENT);

export const handler = Sentry.AWSLambda.wrapHandler(async (event: APIGatewayEvent) => {
  if (!event.body) {
    console.log("Event has no body - will not be forwarded to the API");
    return defaultResponse();
  }

  const secret: string = (await getSecret(fitbitClientSecretName)) as string;
  if (!secret) {
    throw new Error(`Config error - FITBIT_CLIENT_SECRET doesn't exist`);
  }

  const verificationSuccessful = verifyRequest(event, secret);
  console.log("WH Verification success", verificationSuccessful);
  if (verificationSuccessful) {
    return forwardCallToServer(event);
  }

  capture.message("Fitbit webhooks authentication fail", {
    extra: { context: "webhook.fitbit.webhook-authentication" },
  });
  return buildResponse(status.NOT_FOUND);
});

async function forwardCallToServer(event: APIGatewayEvent) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, event.body, { headers: event.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}

/**
 * Checks for authenticity of the webhook notification by comparing a hashed value of the client secret to the fitbit signature provided in the request.
 *
 * @param event APIGatewayProxyEvent
 * @param secret Secret Client key for Fitbit
 * @returns boolean
 */
function verifyRequest(event: APIGatewayEvent, secret: string) {
  if (event.body) {
    const signingKey = secret + "&";
    const hash = createHmac("sha1", signingKey).update(event.body).digest();
    const encodedHash = Buffer.from(hash).toString("base64");

    if (encodedHash === event.headers["X-Fitbit-Signature"]) return true;
  }
  return false;
}
