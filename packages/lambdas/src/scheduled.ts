import * as Sentry from "@sentry/serverless";
import * as http from "http";
import * as https from "https";
import * as URL from "url";
import { capture } from "./shared/capture";
import { getEnv, getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const url = getEnvOrFail("URL");
const timeoutRaw = getEnv("TIMEOUT_MILLIS");
const timeoutMillis = timeoutRaw != undefined ? Number(timeoutRaw) : undefined;

/**
 * Lambda that just triggers an endpoint, it doesn't wait for the response.
 *
 * Usually applied to scheduled jobs, it gets triggered by CloudWatch events
 * and calls an endpoint with no authentication.
 */
export const handler = Sentry.AWSLambda.wrapHandler(async event => {
  try {
    console.log(`Calling POST ${url}`);

    await sendRequest({ url, method: "POST" });

    console.log(`Done, request completed. (not waiting for a response)`);
  } catch (error) {
    console.log(`Error calling ${url}; ${error}`);
    capture.error(error, { extra: { url, event, lambdaName, error } });
    throw error;
  }
});

// write a function to convert object keys into an array

/**
 * Sends a POST request without waiting for the response, only for
 * the confirmation the request was received.
 *
 * @param param.url
 * @param param.method
 * @param param.data
 * @returns the request object, not waiting for the response
 */
async function sendRequest({
  url,
  method,
  data,
}: {
  url: string;
  method: "GET" | "POST" | "PUT" | "HEAD" | "DELETE" | "OPTIONS" | "PATCH";
  data?: Record<string, unknown>;
}): Promise<http.ClientRequest> {
  const decodedURL = URL.parse(url);
  return new Promise(resolve => {
    const httpx = decodedURL.protocol === "https:" ? https : http;
    const req = httpx.request({
      protocol: decodedURL.protocol,
      host: decodedURL.hostname,
      port: decodedURL.port ?? undefined,
      path: decodedURL.path,
      method,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: timeoutMillis,
    });

    data && req.write(JSON.stringify(data));
    req.end(() => {
      /* Request has been fully sent */
      resolve(req);
    });
  });
}
