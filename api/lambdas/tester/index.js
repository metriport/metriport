import * as Sentry from "@sentry/serverless";
import axios from "axios";

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const envType = getEnvOrFail("ENV_TYPE");
const sentryDsn = getEnv("SENTRY_DSN");

// Keep this as early on the file as possible
Sentry.init({
  dsn: sentryDsn,
  enabled: sentryDsn != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

const api = axios.create({ timeout: 10_000 });
// OSS API
const url = "http://Stagi-APIFa-L2I135INABM3-e3a33dd4470439f2.elb.us-east-2.amazonaws.com";

// Test lambda, to validate/test stuff on the cloud env
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Running, calling ${url}...`);
  const res = await api.get(url);
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.data)}`);

  console.log(`Done`);
});
