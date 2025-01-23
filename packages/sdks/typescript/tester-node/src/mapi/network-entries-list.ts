import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";

/**
 * Script to make it easy to test the API SDK.
 * TODO: move this to an E2E test on the API SDK itself.
 */
const apiUrl = getEnvVarOrFail("API_URL");
const apiToken = getEnvVarOrFail("API_KEY");

async function main() {
  const metriport = new MetriportMedicalApi(apiToken, {
    baseAddress: apiUrl,
  });

  try {
    console.log(`Calling listNetworkEntries...`);
    const networkEntries = await metriport.listNetworkEntries();
    console.log(`First page: ${JSON.stringify(networkEntries, null, 2)}`);

  } catch (error) {
    console.log(`error: `, error);
  }
}

main();
