import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { ingestPatientConsolidated } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-lexical";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { BulkResponseErrorItem } from "@metriport/core/external/opensearch/shared/bulk";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { initSentry } from "../shared/sentry";

dayjs.extend(duration);

/**
 * Script to ingest a patient's consolidated resources into OpenSearch for semantic search.
 *
 * Stores the individual errors to ingest resources into a NDJSON in the `./runs/semantic-ingest` folder.
 *
 * Usage:
 * - set the env vars
 * - run with: `ts-node src/open-search/semantic-ingest.ts`
 */

const patientId = getEnvVarOrFail("PATIENT_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});

const outputFolderName = `semantic-ingest`;
initRunsFolder(outputFolderName);
const getFolderName = buildGetDirPathInside(outputFolderName);
const outputFilePrefix = getFolderName(`${cxId}_${patientId}`);
const outputFilePath = outputFilePrefix + ".ndjson";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  initSentry();
  console.log("Running test ingestion...");

  const patientDto = await metriportAPI.getPatient(patientId);
  const patient = getDomainFromDTO(patientDto, cxId);

  await ingestPatientConsolidated({ patient, onItemError });

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function onItemError(error: BulkResponseErrorItem) {
  fs.appendFileSync(outputFilePath, `${JSON.stringify(error)}\n`);
}

if (require.main === module) {
  main();
}
