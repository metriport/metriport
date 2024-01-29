import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import { APIGatewayEvent } from "aws-lambda";
import axios from "axios";
import { createHmac } from "crypto";
import status from "http-status";
import { getEnvOrFail } from "./shared/env";

const apiServerURL = getEnvOrFail("API_URL");
const fitbitClientSecretName = getEnvOrFail("FITBIT_CLIENT_SECRET");
const fitbitTimeoutInMillis = getEnvOrFail("FITBIT_TIMEOUT_MS");

const api = axios.create({
  timeout: Math.max(Number(fitbitTimeoutInMillis) - 100, 100),
});

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
    throw new Error(`Config error - FITBIT_CLIENT_SECRET not found`);
  }

  const verificationSuccessful = verifyRequest(event, event.body, secret);
  console.log("WH Verification success", verificationSuccessful);
  if (verificationSuccessful) {
    return forwardCallToServer(event);
  }

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
 * @param body APIGatewayProxyEvent body
 * @param secret Secret Client key for Fitbit
 * @returns boolean
 */
function verifyRequest(event: APIGatewayEvent, body: string, secret: string) {
  const signingKey = secret + "&";
  const hash = createHmac("sha1", signingKey).update(body).digest();
  // TODO use core's base64 functions
  const encodedHash = Buffer.from(hash).toString("base64");

  if (encodedHash === event.headers["X-Fitbit-Signature"]) return true;
  return false;
}
