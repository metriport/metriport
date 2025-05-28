import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getConsolidatedAsText } from "@metriport/core/command/consolidated/consolidated-get";
import { getDomainFromDTO } from "@metriport/core/command/patient-loader-metriport-api";
import {
  bundleToString,
  FhirResourceToText,
} from "@metriport/core/external/fhir/export/string/bundle-to-string";
import { getFileContents } from "@metriport/core/util/fs";
import { sleep } from "@metriport/core/util/sleep";
import { getEnvVar } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * Script to output the text used for semantic search from a patient's consolidated resources.
 *
 * Usage:
 * - if you set `bundleFilePath`, it will load a FHIR Bundle from the file
 *   - in this case, you don't need to set the other env vars
 * - if you don't set `bundleFilePath`, it will get the resources from the API
 *
 * Run with:
 * - ts-node src/open-search/semantic-text-from-consolidated.ts
 */

const bundleFilePath: string | undefined = undefined;
const patientId = getEnvVar("PATIENT_ID");
const apiKey = getEnvVar("API_KEY");
const apiUrl = getEnvVar("API_URL");
const cxId = getEnvVar("CX_ID");

const outputRootFolderName = `semantic-text-from-consolidated`;

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  initRunsFolder(outputRootFolderName);
  const getFolderName = buildGetDirPathInside(outputRootFolderName);
  const outputFilePrefix = getFolderName(`${cxId}_${patientId}`);
  const outputFilePath = outputFilePrefix + ".csv";

  let resources: FhirResourceToText[] = [];
  if (bundleFilePath) {
    console.log("Getting resources from file...");
    const bundleContents = getFileContents(bundleFilePath);
    const bundle = JSON.parse(bundleContents);
    resources = bundleToString(bundle);
  } else {
    if (!apiKey || !apiUrl || !patientId || !cxId) {
      throw new Error("Environment variables must be set if bundleFilePath is not set");
    }
    console.log("Getting consolidated resources from the API...");
    const metriportAPI = new MetriportMedicalApi(apiKey, {
      baseAddress: apiUrl,
      timeout: 120_000,
    });
    const patientDto = await metriportAPI.getPatient(patientId);
    const patient = getDomainFromDTO(patientDto, cxId);
    resources = await getConsolidatedAsText({ patient });
  }

  const headers = ["id", "type", "text"];
  const resourcesAsCsv = [headers, ...resources.map(r => [r.id, r.type, `"${r.text}"`])].join("\n");

  fs.writeFileSync(outputFilePath, resourcesAsCsv);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
  console.log(`>>> Output file: ${outputFilePath}`);
}

if (require.main === module) {
  main();
}
