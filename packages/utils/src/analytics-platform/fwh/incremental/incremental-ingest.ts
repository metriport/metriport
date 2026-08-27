import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import readline from "readline/promises";
import { getAllPatientIds } from "../../../patient/get-ids";
import { elapsedTimeAsStr } from "../../../shared/duration";
import { initFile } from "../../../shared/file";
import { buildPathInsideRunsFolder, initRunsFolder } from "../../../shared/folder";
import { getCxData } from "../../../shared/get-cx-data";
import { getIdsFromFile } from "../../../shared/ids";

dayjs.extend(duration);

/**
 * This script triggers the incremental ingestion into the analytics platform for each patient.
 * It calls the /internal/analytics-platform/ingestion/manual-incremental endpoint for each patient.
 *
 * IMPORTANT: The cxsWithAnalyticsIncrementalIngestion feature flag must be enabled for the
 * customer before running this script.
 *
 * If a file is provided, it will read patient IDs from the file and use them instead of the
 * patientIds array.
 *
 * Usage:
 * - set env vars on .env file
 * - set patientIds array with the patient IDs you want to ingest - leave empty to run for all
 *   patients of the customer
 * - optionally, pass the name of a file containing patient IDs to ingest with the -f flag
 * - run it
 *   - ts-node src/analytics-platform incremental-ingest
 *   - ts-node src/analytics-platform incremental-ingest -f <file-with-patient-ids>
 */

// Leave empty to run for all patients of the customer
const patientIds: string[] = [];

const jobId = "INC_" + buildDayjs().toISOString().slice(0, 19).replace(/[:.]/g, "-");

const cxId = getEnvVarOrFail("CX_ID");
const apiUrl = getEnvVarOrFail("API_URL");

const api = axios.create({ baseURL: apiUrl });

const folderName = buildPathInsideRunsFolder(`incremental-ingest`);

const program = new Command();
program
  .name("incremental-ingest")
  .description("CLI to trigger incremental ingestion into the analytics platform for patients")
  .option("-f, --file <path>", "Path to file with patient IDs (optional)")
  .option(
    "-p, --parallel <number>",
    "Number of parallel requests (default: 10)",
    value => parseInt(value, 10),
    10
  )
  .showHelpAfterError()
  .action(main);

async function main({ file: fileName, parallel }: { file?: string; parallel: number }) {
  await sleep(50);
  initRunsFolder();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting at ${buildDayjs().toISOString()}...`);

  if (fileName) {
    if (patientIds.length > 0) {
      log(`>>> Patient IDs provided (${patientIds.length}), skipping file ${fileName}`);
    } else {
      const idsFromFile = getIdsFromFile(fileName);
      if (idsFromFile.length < 1) {
        log(`>>> Empty file ${fileName}`);
        return;
      }
      patientIds.push(...idsFromFile);
      log(`>>> Found ${patientIds.length} patient IDs in ${fileName}`);
    }
  }

  const { orgName } = await getCxData(cxId, undefined, false);

  const isAllPatients = patientIds.length < 1;
  const patientsToIngest = isAllPatients
    ? await getAllPatientIds({ axios: api, cxId })
    : patientIds;
  const uniquePatientIds = [...new Set(patientsToIngest)];

  const totalPatients = uniquePatientIds.length;

  await displayWarningAndConfirmation(uniquePatientIds, isAllPatients, totalPatients, orgName, log);
  log(`>>> Running it... ${uniquePatientIds.length} patients, jobId: ${jobId}`);

  const failedPatientIds: { patientId: string; error: string }[] = [];
  let processedCount = 0;

  await executeAsynchronously(
    uniquePatientIds,
    async patientId => {
      try {
        await api.post("/internal/analytics-platform/ingestion/incremental", null, {
          params: { cxId, patientId },
        });
      } catch (error) {
        failedPatientIds.push({ patientId, error: errorToString(error) });
      }
      processedCount++;
      if (processedCount % 100 === 0) {
        log(`>>> Processed ${processedCount} patients (${totalPatients} total)`);
      }
    },
    { numberOfParallelExecutions: parallel, minJitterMillis: 10, maxJitterMillis: 100 }
  );

  log(``);
  if (failedPatientIds.length > 0) {
    const outputFolder = `${folderName}/${jobId}`;
    initFile(`${outputFolder}/placeholder`);

    const failedIdsFile = `${outputFolder}/failed-patient-ids.txt`;
    const failedDetailsFile = `${outputFolder}/failed-patient-details.json`;

    fs.writeFileSync(failedIdsFile, failedPatientIds.map(f => f.patientId).join("\n"));
    fs.writeFileSync(failedDetailsFile, JSON.stringify(failedPatientIds, null, 2));

    log(
      `>>> FAILED to ingest ${failedPatientIds.length} patients - see ${failedIdsFile} and ${failedDetailsFile}`
    );
  }
  const amountOfPatientsProcessed = uniquePatientIds.length - failedPatientIds.length;
  log(
    `>>> Successfully ingested ${amountOfPatientsProcessed} patients in ${elapsedTimeAsStr(
      startedAt
    )}`
  );
  log(`- jobId: ${jobId}`);
}

async function displayWarningAndConfirmation(
  patientsToIngest: string[],
  isAllPatients: boolean,
  totalPatients: number,
  orgName: string,
  log: typeof console.log
) {
  const allPatientsMsg = isAllPatients ? ` That's all patients of customer ${cxId}!` : "";
  const msg =
    `You are about to trigger incremental ingestion for ${patientsToIngest.length} patients ` +
    `(out of ${totalPatients}) of customer ${orgName} (${cxId}).${allPatientsMsg}`;
  log(msg);
  log(``);
  log(
    `IMPORTANT: The 'cxsWithAnalyticsIncrementalIngestion' feature flag must be enabled ` +
      `for this customer (${cxId}) before proceeding!`
  );
  log(``);
  log("Are you sure you want to proceed?");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question("Type 'yes' to proceed: ");
  if (answer !== "yes") {
    log("Aborting...");
    process.exit(0);
  }
  rl.close();
}

export default program;
