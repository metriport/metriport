import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getDelayTime } from "../shared/duration";
import { initFile } from "../shared/file";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";
import { logErrorToFile } from "../shared/log";

dayjs.extend(duration);

/**
 * This script triggers the recreation of consolidated data for multiple patients.
 * It makes parallel requests to the API to recreate consolidated data for each patient.
 *
 * Update the `patientIds` array with the list of Patient IDs you want to recreate consolidated data for.
 * Alternatively, you can provide a file with patient IDs, one per line.
 *
 * Successfully processed patient IDs are saved in a file in the `runs/recreate-consolidated` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.success.patientIds.txt
 *
 * Any errors encountered during processing are saved in two files in the `runs/recreate-consolidated` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.error.patientIds.txt
 * $ packages/utils/runs/recreate-consolidated/<cx-name>_2025-06-19T06:56:19.714Z.error.txt (detailed error)
 *
 * The delay time between requests is managed by the `getDelayTime` function, which
 * ensures we don't overwhelm the system while maintaining good throughput.
 *
 * Execute this with:
 * $ npm run bulk-recreate-consolidated
 */

// Add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line
const fileName = "";

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create({ baseURL: apiUrl });

// query stuff
const minimumDelayTime = dayjs.duration(10, "milliseconds");
const defaultDelayTime = dayjs.duration(100, "milliseconds");
const confirmationTime = dayjs.duration(10, "seconds");

const numberOfParallelExecutions = 30;

// output stuff
const getOutputFileName = buildGetDirPathInside(`recreate-consolidated`);
const patientsWithErrors: string[] = [];

const program = new Command();
program
  .name("recreate-consolidated")
  .description("CLI to recreate consolidated data for multiple patients.")

  .showHelpAfterError();

async function main() {
  initRunsFolder();
  program.parse();
  const { log } = out("");

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const fileContents = getFileContents(fileName);
      patientIds.push(...fileContents.split("\n"));
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  if (patientIds.length === 0) {
    log(">>> No patient IDs provided. Please add patient IDs to the patientIds array.");
    process.exit(1);
  }

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);

  const { orgName } = await getCxData(cxId, undefined, false);
  await displayWarningAndConfirmation(patientIds.length, orgName, log);

  const errorFileName = getOutputFileName(orgName) + ".error";
  initFile(errorFileName);
  const successFileName = getOutputFileName(orgName) + ".success";
  initFile(successFileName);

  log(`>>> Running it...`);

  let ptIndex = 0;
  await executeAsynchronously(
    patientIds,
    async patientId => {
      await recreateConsolidatedForPatient(patientId, cxId, successFileName, errorFileName, log);
      log(`>>> Progress: ${++ptIndex}/${patientIds.length} patients complete`);
      const delayTime = getDelayTime({ log, minimumDelayTime, defaultDelayTime });
      log(`...sleeping for ${delayTime} ms`);
      await sleep(delayTime);
    },
    { numberOfParallelExecutions, minJitterMillis: 5, maxJitterMillis: 100 }
  );
  if (patientsWithErrors.length > 0) {
    log(
      `>>> Patients with errors (${patientsWithErrors.length}): ${patientsWithErrors.join(", ")}`
    );
    log(`>>> See file ${errorFileName} for more details.`);
  } else {
    log(`>>> No patient with errors!`);
  }
  const ellapsed = Date.now() - startedAt;
  log(`>>> Done recreating consolidated for all ${patientIds.length} patients in ${ellapsed} ms`);
  process.exit(0);
}

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  orgName: string,
  log: typeof console.log
) {
  const msg = `You are about to recreate consolidated data for ${patientCount} patients of the org/cx ${orgName}.`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function recreateConsolidatedForPatient(
  patientId: string,
  cxId: string,
  successFileName: string,
  errorFileName: string,
  log: typeof console.log
) {
  try {
    await api.post(`/internal/patient/${patientId}/consolidated/refresh?cxId=${cxId}`);
    log(`>>> Done recreate consolidated for patient ${patientId}...`);
    fs.appendFileSync(successFileName + ".patientIds.txt", `${patientId}\n`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error) {
    const msg = `ERROR processing patient ${patientId}: `;
    log(`${msg}${errorToString(error)}`);
    patientsWithErrors.push(patientId);
    logErrorToFile(errorFileName, msg, error as Error);
    fs.appendFileSync(errorFileName + ".patientIds.txt", `${patientId}\n`);
  }
}

main();
