import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getAllPatientIds } from "../patient/get-ids";
import { elapsedTimeAsStr, getDelayTime } from "../shared/duration";
import { initFile } from "../shared/file";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";
import { getCxData } from "../shared/get-cx-data";
import { logErrorToFile } from "../shared/log";

dayjs.extend(duration);

/**
 * This script triggers network queries for laboratory sources for multiple patients.
 * It makes parallel requests to the API to query laboratory documents for each patient.
 *
 * IMPORTANT: Network queries can trigger document downloads and processing. Be mindful about
 * the delay/sleep time to avoid overwhelming the system. We recommend keeping the delay
 * at least 100 milliseconds.
 *
 * Update the `patientIds` array with the list of Patient IDs you want to query laboratory sources for.
 * Alternatively, you can provide a file with patient IDs, one per line.
 *
 * Successfully processed patient IDs are saved in a file in the `runs/backfill-roster-quest` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/backfill-roster-quest/<cx-name>_2025-06-19T06:56:19.714Z.success.patientIds.txt
 *
 * Any errors encountered during processing are saved in two files in the `runs/backfill-roster-quest` folder,
 * named with the customer's name and timestamp, e.g.,:
 * $ packages/utils/runs/backfill-roster-quest/<cx-name>_2025-06-19T06:56:19.714Z.error.patientIds.txt
 * $ packages/utils/runs/backfill-roster-quest/<cx-name>_2025-06-19T06:56:19.714Z.error.txt (detailed error)
 *
 * The delay time between requests is managed by the `getDelayTime` function, which
 * ensures we don't overwhelm the system while maintaining good throughput.
 *
 * Execute this with:
 * $ ts-node src/quest/bulk-add-patients-to-backfill-roster.ts
 */

// Add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];
// Alternatively, you can provide a file with patient IDs, one per line, no header!
const fileName = "";

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");
const api = axios.create({ baseURL: apiUrl });

// query stuff
const minimumDelayTime = dayjs.duration(100, "milliseconds");
const defaultDelayTime = dayjs.duration(200, "milliseconds");
const confirmationTime = dayjs.duration(10, "seconds");

const numberOfParallelExecutions = 1;

// output stuff
const getOutputFileName = buildGetDirPathInside(`backfill-roster-quest`);
const patientsWithErrors: string[] = [];

const program = new Command();
program
  .name("bulk-add-patients-to-backfill-roster")
  .description("CLI to trigger laboratory network queries for multiple patients.")
  .showHelpAfterError();

async function main() {
  initRunsFolder();
  program.parse();
  const { log } = out("");
  log(`############# Starting at ${buildDayjs().toISOString()}`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const fileContents = getFileContents(fileName);
      const idsFromFile = fileContents
        .split(/\r?\n/)
        .map(id => id.replaceAll('"', "").replaceAll("'", "").trim())
        .filter(id => id.length > 0 && id.toLowerCase() !== "id");
      patientIds.push(...idsFromFile);
      if (patientIds.length < 1) {
        log(`>>> Empty file ${fileName}`);
        process.exit(1);
      }
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length === 0;
  if (isAllPatients) {
    log(`>>> No patient IDs provided, fetching all patients for cx ${orgName}...`);
    const allPatientIds = await getAllPatientIds({ axios: api, cxId });
    patientIds.push(...allPatientIds);
    if (patientIds.length === 0) {
      log(">>> No patients found for this customer.");
      process.exit(1);
    }
    log(`>>> Found ${patientIds.length} patients for cx ${orgName}`);
  }

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);
  await displayWarningAndConfirmation(patientIds.length, orgName, isAllPatients, log);

  const errorFileName = getOutputFileName(orgName) + ".error";
  initFile(errorFileName);
  const successFileName = getOutputFileName(orgName) + ".success";
  initFile(successFileName);

  log(`>>> Running it...`);

  let ptIndex = 0;
  await executeAsynchronously(
    patientIds,
    async patientId => {
      await triggerNetworkQueryForPatient(patientId, cxId, successFileName, errorFileName, log);
      log(`>>> Progress: ${++ptIndex}/${patientIds.length} patients complete`);
      const delayTime = getDelayTime({ log, minimumDelayTime, defaultDelayTime });
      log(`...sleeping for ${delayTime} ms`);
      await sleep(delayTime);
    },
    { numberOfParallelExecutions, minJitterMillis: 500, maxJitterMillis: 1000 }
  );
  if (patientsWithErrors.length > 0) {
    log(
      `>>> Patients with errors (${patientsWithErrors.length}): ${patientsWithErrors.join(", ")}`
    );
    log(`>>> See file ${errorFileName} for more details.`);
  } else {
    log(`>>> No patient with errors!`);
  }
  log(
    `############# Done triggering network queries for all ${
      patientIds.length
    } patients in ${elapsedTimeAsStr(startedAt)}`
  );
  process.exit(0);
}

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  orgName: string,
  isAllPatients: boolean,
  log: typeof console.log
) {
  const scope = isAllPatients ? "ALL" : patientCount?.toString() ?? "unknown";
  const msg = `You are about to trigger laboratory network queries for ${scope} patients of the org/cx ${orgName}.`;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function triggerNetworkQueryForPatient(
  patientId: string,
  cxId: string,
  successFileName: string,
  errorFileName: string,
  log: typeof console.log
): Promise<void> {
  try {
    await api.post(`/internal/network-query/query?cxId=${cxId}&patientId=${patientId}`, {
      sources: ["laboratory"],
    });
    log(`>>> Done trigger network query for patient ${patientId}...`);
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
