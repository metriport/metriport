import { executeWithNetworkRetries, getEnvVar } from "@metriport/shared";
import * as http from "http";
import * as https from "https";
import * as URL from "url";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

// Automatically set by AWS
const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const apiUrl = getEnvVar("API_URL");
const url = getEnvVar("URL");
const endpoint = getEnvVar("ENDPOINT");
const timeoutRaw = getEnvVar("TIMEOUT_MILLIS");
const timeoutMillis = timeoutRaw != undefined ? Number(timeoutRaw) : undefined;

/**
 * Lambda that just triggers an endpoint, it doesn't wait for the response.
 *
 * Usually applied to scheduled jobs, it gets triggered by CloudWatch events
 * and calls an endpoint with no authentication.
 */
export const handler = capture.wrapHandler(async event => {
  let fullUrl: string | undefined = url;
  try {
    if (!url) {
      if (!apiUrl || !endpoint) {
        throw new Error("URL or (API_URL + ENDPOINT) are required");
      }
      fullUrl = apiUrl + endpoint;
    }
    const urlToCall = fullUrl;
    if (!urlToCall) throw new Error("Promigramming error, urlToCall is undefined");

    console.log(`Calling POST ${fullUrl}`);

    await executeWithNetworkRetries(() => sendRequest({ url: urlToCall, method: "POST" }));

    console.log(`Done, request completed. (not waiting for a response)`);
  } catch (error) {
    console.log(`Error calling ${fullUrl}; ${error}`);
    capture.error(error, { extra: { url, apiUrl, endpoint, event, lambdaName, error } });
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
