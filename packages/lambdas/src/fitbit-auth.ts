import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { createHmac } from "crypto";
import { Request } from "express";
import status from "http-status";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

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

export const handler = Sentry.AWSLambda.wrapHandler(async (req: Request) => {
  if (!req.body) {
    console.log("Request has no body - will not be forwarded to the API");
    return defaultResponse();
  }

  const secret: string = (await getSecret(fitbitClientSecretName)) as string;
  if (!secret) {
    throw new Error(`Config error - FITBIT_CLIENT_SECRET doesn't exist`);
  }

  if (verifyRequest(req, secret)) {
    return forwardCallToServer(req);
  }

  capture.message("Fitbit webhooks authentication fail", {
    extra: { context: "webhook.fitbit.webhook-authentication" },
  });
  return buildResponse(status.NOT_FOUND);
});

async function forwardCallToServer(req: Request) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, req.body, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}

/**
 * Checks for authenticity of the webhook notification by comparing a hashed value of the client secret to the fitbit signature provided in the request.
 *
 * @param req Request
 * @param secret Secret Client key for Fitbit
 * @returns boolean
 */
function verifyRequest(req: Request, secret: string) {
  const bodyString = JSON.stringify(req.body);

  const signingKey = secret + "&";
  const hash = createHmac("sha1", signingKey).update(bodyString).digest();
  const encodedHash = Buffer.from(hash).toString("base64");

  if (encodedHash === req.headers["x-fitbit-signature"]) return true;
  return false;
}
