import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi, NetworkEntry } from "@metriport/api-sdk";
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
    let page = 1;
    const allNetworkEntries: NetworkEntry[] = [];
    const { meta, networkEntries } = await metriport.listNetworkEntries();
    console.log(`Page ${page++} has ${networkEntries.length} networkEntries (next page? ${!!meta.nextPage})`);
    allNetworkEntries.push(...networkEntries);
    let nextPage = meta.nextPage;
    while (nextPage) {
      const { meta, networkEntries } = await metriport.listNetworkEntriesPage(nextPage);
      console.log(`Page ${page++} has ${networkEntries.length} networkEntries (next page? ${!!meta.nextPage})`);
      allNetworkEntries.push(...networkEntries);
      nextPage = meta.nextPage;
    }
    console.log(
      `All NetworkEntries: ${JSON.stringify({ networkEntries: allNetworkEntries }, null, 2)}`
    );
  } catch (error) {
    console.log(`error: `, error);
  }
}

main();
