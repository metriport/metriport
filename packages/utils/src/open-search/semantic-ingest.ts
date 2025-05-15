import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { ingestSemantic } from "@metriport/core/external/opensearch/semantic/ingest";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { elapsedTimeAsStr } from "../shared/duration";

dayjs.extend(duration);

/**
 * Script to ingest a patient's consolidated resources into OpenSearch for semantic search.
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

  console.log("Running test ingestion...");

  const patientDto = await metriportAPI.getPatient(patientId);
  const patient = getDomainFromDTO(patientDto, cxId);

  await ingestSemantic({ patient });

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
