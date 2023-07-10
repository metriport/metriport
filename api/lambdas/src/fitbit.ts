import * as Sentry from "@sentry/serverless";
import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { createHmac } from "crypto";
import axios from "axios";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const apiServerURL = getEnvOrFail("API_URL");

const api = axios.create();

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { body?: any; headers: Record<string, string | undefined> };

export const handler = Sentry.AWSLambda.wrapHandler(async (req: Request) => {
  console.log(`Verifying at least one UserAuthToken on body...`);

  if (!req.body) {
    console.log("Resquest has no body - will not be forwarded to the API");
    return defaultResponse();
  }

  const secret = await getSecret("FITBIT_CLIENT_SECRET");
  if (!secret) {
    throw new Error(`Config error - FITBIT_CLIENT_SECRET doesn't exist`);
  }

  if (verifyRequest(req, secret)) {
    return forwardCallToServer(req);
  }

  capture.message("Fitbit webhooks authentication fail", {
    extra: { context: "webhook.fitbit.webhook-authentication" },
  });
  return buildResponse(404);
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
