import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { errorToString, sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import { confirm } from "./shared/confirm";
import { getDelayTime } from "./shared/duration";
import { initFile } from "./shared/file";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";

/**
 * This script kicks off the patient discovery for the indicated patients.
 *
 * To run:
 * 1. Set the env vars:
 *  - CX_ID
 *  - API_URL
 * 2. Set the patientIds array or provide a file with patient IDs, one per line.
 * 3. Run the script with `ts-node src/bulk-trigger-patient-discovery.ts`
 *
 * The delay time between chunks is read from getDelayTime() (see delay-time-in-millis.txt).
 */

dayjs.extend(duration);

const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line
const fileName = "";

const rerunPdOnNewDemographics = true;

const defaultDelayTime = dayjs.duration(10, "seconds");
const minimumDelayTime = dayjs.duration(1, "seconds");
const SCRIPT_NAME = "bulk-trigger-patient-discovery";
const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const PATIENT_CHUNK_SIZE = 2;

type PdResponse = {
  data: {
    requestId: string;
  };
};

async function main() {
  const idsToProcess = [...patientIds];
  if (fileName && idsToProcess.length === 0) {
    const fileContents = getFileContents(fileName);
    const idsFromFile = fileContents
      .split(/\r?\n/)
      .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
      .filter(id => id.length > 0 && id.toLowerCase() !== "id");
    idsToProcess.push(...idsFromFile);
    console.log(`>>> Found ${idsToProcess.length} patient IDs in ${fileName}`);
  }

  if (idsToProcess.length === 0) {
    console.log(">>> No patient IDs provided. Set patientIds array or fileName.");
    return;
  }

  initRunsFolder();
  const outputDir = buildGetDirPathInside(SCRIPT_NAME)();
  const successFileName = `${outputDir}/success.csv`;
  const errorFileName = `${outputDir}/error.csv`;
  initFile(successFileName);
  initFile(errorFileName);

  const { log } = out("");
  log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
  await confirm(
    `Triggering patient discovery for ${idsToProcess.length} patients. CX: ${cxId}.`,
    log
  );

  const patientChunks = chunk(idsToProcess, PATIENT_CHUNK_SIZE);

  for (const [i, patients] of patientChunks.entries()) {
    console.log(`Chunk ${i + 1} of ${patientChunks.length}`);
    console.log(`# of patients ${patients.length}`);

    for (const patientId of patients) {
      try {
        const pdLog = out(`PD kick off: cxId - ${cxId}, patientId - ${patientId}`).log;
        const endpointUrl = `${apiUrl}/internal/patient/${patientId}/patient-discovery`;
        const params = new URLSearchParams({
          cxId,
          rerunPdOnNewDemographics: rerunPdOnNewDemographics.toString(),
        });
        const resp = (await axios.post(`${endpointUrl}?${params}`)) as PdResponse;
        pdLog(`Request ID - ${JSON.stringify(resp.data.requestId)}`);
        fs.appendFileSync(successFileName, `${patientId}\n`);
      } catch (err) {
        log(`ERROR triggering PD for patient ${patientId}: ${errorToString(err)}`);
        fs.appendFileSync(errorFileName, `${patientId}\n`);
      }
    }
    if (i < patientChunks.length - 1) {
      const sleepTime = getDelayTime({ log, minimumDelayTime, defaultDelayTime });
      log(`Chunk ${i + 1} finished. Sleeping for ${sleepTime} ms...`);
      await sleep(sleepTime);
    }
  }

  log(`>>> Done. Output files: ${outputDir}/success.csv, ${outputDir}/error.csv`);
}

main();
