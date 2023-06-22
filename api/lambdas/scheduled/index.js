import * as Sentry from "@sentry/serverless";
import * as http from "http";
import * as https from "https";
import * as URL from "url";

function getEnv(name) {
  return process.env[name];
}
function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

// Automatically set by AWS
const lambdaName = getEnv("AWS_LAMBDA_FUNCTION_NAME");
// Set by us
const envType = getEnvOrFail("ENV_TYPE");
const sentryDsn = getEnv("SENTRY_DSN");
const url = getEnvOrFail("URL");
const timeoutMillis = Number(getEnvOrFail("TIMEOUT_MILLIS"));

// Keep this as early on the file as possible
Sentry.init({
  dsn: sentryDsn,
  enabled: sentryDsn != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

/**
 * Lambda that just triggers an endpoint, it doesn't wait for the response.
 *
 * Usually applied to scheduled jobs, it gets triggered by CloudWatch events
 * and calls an endpoint with no authentication.
 */
export const handler = async event => {
  try {
    console.log(`Calling POST ${url}`);

    await sendRequest({ url, method: "POST" });

    console.log(`Done, request completed. (not waiting for a response)`);
  } catch (error) {
    console.log(`Error calling ${url}; ${JSON.stringify(error)}`);
    captureException(error, { extra: { url, event, lambdaName, error } });
    throw error;
  }
};

// write a function to convert object keys into an array

/**
 * Sends a POST request without waiting for the response, only for
 * the confirmation the request was received.
 *
 * @param {string} param.url
 * @param {string} param.method
 * @param {string} param.authToken
 * @param {Record<string, unknown>} param.data
 * @returns {Promise<ClientRequest>}
 */
async function sendRequest({ url, method, data }) {
  const decodedURL = URL.parse(url);
  return new Promise(resolve => {
    const httpx = decodedURL.protocol === "https:" ? https : http;
    const req = httpx.request({
      protocol: decodedURL.protocol,
      host: decodedURL.hostname,
      port: decodedURL.port ?? undefined,
      path: decodedURL.path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        // ...(authToken ? { "api-key": authToken } : undefined),
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

// Keep all capture* functions regardless of usage, so its easier to keep them in sync/the same
// so later we can move them to a lambda layer
function captureException(error, captureContext) {
  const extra = captureContext ? stringifyExtra(captureContext) : {};
  return Sentry.captureException(error, {
    ...captureContext,
    extra,
  });
}
function captureMessage(message, captureContext) {
  const extra = captureContext ? stringifyExtra(captureContext) : {};
  return Sentry.captureMessage(message, {
    ...captureContext,
    extra,
  });
}
function stringifyExtra(captureContext) {
  return Object.entries(captureContext.extra ?? {}).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: JSON.stringify(value, null, 2),
    }),
    {}
  );
}
