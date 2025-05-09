import { getEnvVarOrFail } from "@metriport/shared";
import * as Sentry from "@sentry/serverless";
import axios from "axios";
import { capture } from "./shared/capture";

// Keep this as early on the file as possible
capture.init();

const apiUrl = getEnvVarOrFail("API_URL");
// OSS API
const url = "http://" + apiUrl;
const api = axios.create({ timeout: 10_000 });

/**
 * Test lambda, to validate/test stuff on the cloud env
 *
 * Update this code as needed to perform the test you want.
 */
// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(async () => {
  console.log(`Running...`);

  console.log(`Calling ${url}...`);
  const res = await api.get(url);
  console.log(`Success! Response status: ${res.status}, body: ${JSON.stringify(res.data)}`);

  console.log(`Done`);
});
