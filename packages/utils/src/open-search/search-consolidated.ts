import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { searchPatientConsolidated } from "@metriport/core/command/consolidated/search/fhir-resource/search-consolidated";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to search a patient's consolidated resources using OpenSearch search.
 *
 * If you want to test the `paginatedSearch` function, use the `paginated-search.ts` script.
 *
 * Usage:
 * - Set the environment variables in the .env file
 * - Run: `ts-node src/open-search/search-consolidated.ts <search-query>`
 */

const cxId = getEnvVarOrFail("CX_ID");
const patientId = getEnvVarOrFail("PATIENT_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  const searchQuery = process.argv[2];
  if (!searchQuery) {
    console.error("Please provide a search query as the first argument");
    process.exit(1);
  }

  const patientDto = await metriportAPI.getPatient(patientId);
  const patient = getDomainFromDTO(patientDto, cxId);

  console.log("Running search with: ", searchQuery);

  const searchResult = await searchPatientConsolidated({
    patient,
    query: searchQuery,
  });
  const searchResultIds = searchResult.entry?.map(r => r.resource?.id) ?? [];
  console.log("Search result count: ", searchResultIds.length);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
