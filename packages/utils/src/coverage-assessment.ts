import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentQuery, MetriportMedicalApi } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import { errorToString } from "@metriport/shared/common/error";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import path from "path";
import { getFileNameForOrg } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script retrieves coverage data for Patients from the DB.
 *
 * Update the `patientIds` with the list of Patient IDs you
 * want to get coverage data for, otherwise it will do it for all
 * Patients of the respective customer (expensive).
 */

// add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];

// auth stuff
const cxId = getEnvVarOrFail("CX_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const sdk = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});
const api = axios.create({ baseURL: apiUrl });

// query stuff
const delayTime = dayjs.duration(3, "seconds");
const numberOfParallelExecutions = 10;
const confirmationTime = dayjs.duration(10, "seconds");

// csv stuff
const csvHeader =
  "patientId,firstName,lastName,state,downloadStatus,docCount,convertStatus,fhirResourceCount,fhirResourceDetails\n";

const csvName = (cxName: string): string =>
  `./runs/coverage-assessment/${getFileNameForOrg(cxName, "csv")}`;

const program = new Command();
program
  .name("coverage-assessment")
  .description("CLI to get coverage/density data multiple patients.")
  .showHelpAfterError();

async function main() {
  program.parse();
  const { log } = out("");

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);
  const { orgName } = await getCxData(cxId, undefined, false);
  const fileName = csvName(orgName);

  initCsv(fileName);

  const patientIdsToQuery = await getPatientIds(log);
  log(`>>> Running it...`);

  await executeAsynchronously(
    patientIdsToQuery,
    async (patientId, itemIdx) => {
      await getCoverageForPatient(patientId, fileName, log);
      log(`>>> Progress: ${itemIdx + 1}/${patientIdsToQuery.length} patients complete`);
      await sleep(delayTime.asMilliseconds());
    },
    { numberOfParallelExecutions }
  );

  const ellapsed = Date.now() - startedAt;
  log(`>>> Done assessing coverage for all ${patientIdsToQuery.length} patients in ${ellapsed} ms`);
  process.exit(0);
}

function initCsv(fileName: string) {
  const dirName = path.dirname(fileName);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  fs.writeFileSync(fileName, csvHeader);
}

async function getPatientIds(log: typeof console.log): Promise<string[]> {
  if (patientIds.length > 0) {
    return patientIds;
  }
  return await getAllPatientIds(log);
}

async function getAllPatientIds(log: typeof console.log): Promise<string[]> {
  displayNoDryRunWarning(log);
  log(
    "You are about to trigger a document query for all patients of the CX. This is very expensive!"
  );
  log("Cancel this script now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
  const resp = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  const patientIds = resp.data.patientIds;
  return (Array.isArray(patientIds) ? patientIds : []) as string[];
}

function displayNoDryRunWarning(log: typeof console.log) {
  // The first chars there are to set color red on the terminal
  // See: // https://stackoverflow.com/a/41407246/2099911
  log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
}

async function getCoverageForPatient(patientId: string, fileName: string, log: typeof console.log) {
  try {
    const [patient, docQueryStatus, fhir] = await Promise.all([
      sdk.getPatient(patientId),
      getDocQueryStatus(cxId, patientId),
      sdk.countPatientConsolidated(patientId),
    ]);
    if (!docQueryStatus) {
      throw new Error(`Document query status not found for patient ${patientId}`);
    }

    const { id, firstName, lastName } = patient;
    const state = Array.isArray(patient.address) ? patient.address[0].state : patient.address.state;

    const { download, convert } = docQueryStatus;
    const downloadStatus = download?.status;
    const docCount = download?.successful;
    const convertStatus = convert?.status;

    const fhirCount = fhir.total;
    const fhirDetails = JSON.stringify(fhir.resources).replaceAll(",", " ");

    // "patientId,firstName,lastName,state,downloadStatus,docCount,convertStatus,fhirResourceCount,fhirResourceDetails\n";
    const csvRow = `${id},${firstName},${lastName},${state},${downloadStatus},${docCount},${convertStatus},${fhirCount},${fhirDetails}\n`;
    fs.appendFileSync(fileName, csvRow);
    log(`>>> Done doc query for patient ${patient.id}...`);
  } catch (error) {
    log(`ERROR processing patient ${patientId}: ${errorToString(error)}`);
  }
}

async function getDocQueryStatus(
  cxId: string,
  patientId: string
): Promise<DocumentQuery | undefined> {
  const resp = await api.get(`/internal/docs/query?cxId=${cxId}&patientId=${patientId}`);
  return resp.data.documentQueryProgress ?? undefined;
}

main();
