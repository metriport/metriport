import { getEnvVarOrFail } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const api = axios.create({ timeout: 10_000 });

// Test lambda, to validate/test stuff on the cloud env
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Running...`);

  // OSS API
  const url = "http://" + getEnvVarOrFail("API_URL");

  console.log(`Calling ${url}...`);
  const res = await api.get(url);
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.data)}`);

  console.log(`Done`);
});
