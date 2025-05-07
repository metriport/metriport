import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import { getConsolidatedAsText } from "@metriport/core/external/opensearch/semantic/ingest";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVarOrFail } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * Script to output the text used for semantic search from a patient's consolidated resources.
 */

const patientId = getEnvVarOrFail("PATIENT_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const cxId = getEnvVarOrFail("CX_ID");

const outputRootFolderName = `semantic-text-from-consolidated`;
const getFolderName = buildGetDirPathInside(outputRootFolderName);

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  console.log("Getting consolidated resources as text...");

  const patientDto = await metriportAPI.getPatient(patientId);
  const patient = getDomainFromDTO(patientDto, cxId);

  const resources = await getConsolidatedAsText({ patient });

  const headers = ["id", "type", "text"];
  const resourcesAsCsv = [headers, ...resources.map(r => [r.id, r.type, `"${r.text}"`])].join("\n");

  const outputFilePrefix = getFolderName(`${cxId}_${patientId}`);
  initRunsFolder(outputFilePrefix);
  const outputFilePath = outputFilePrefix + ".csv";
  fs.writeFileSync(outputFilePath, resourcesAsCsv);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
