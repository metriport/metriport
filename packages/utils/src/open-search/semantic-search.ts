import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { searchSemantic } from "@metriport/core/command/consolidated/search/fhir-resource/search-semantic";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to search a patient's consolidated resources using OpenSearch semantic search.
 */

const patientId = getEnvVarOrFail("PATIENT_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

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

  const searchResult = await searchSemantic({
    patient,
    query: searchQuery,
    maxNumberOfResults: 1_234,
    similarityThreshold: 0.2,
  });
  const searchResultIds = searchResult.entry?.map(r => r.resource?.id) ?? [];
  console.log("Search result: ", searchResultIds.join(", "));

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
