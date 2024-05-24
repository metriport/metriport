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
import { getPatientIds } from "./patient/get-ids";
import { getFileNameForOrg } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script retrieves coverage data for Patients from the DB.
 * It doesn't trigger Document Queries - it assumes this has been already done.
 * @see bulk-query-patients.ts for Document Query
 *
 * Update the `patientIds` with the list of Patient IDs you want to get coverage data for,
 * otherwise it will do it for all Patients of the respective customer (expensive!).
 *
 * Execute this with:
 * $ npm run coverage-assessment
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
  const { patientIds: patientIdsToQuery, isAllPatients } = await getPatientIds({
    cxId,
    patientIds,
    axios,
  });

  await displayWarningAndConfirmation(patientIdsToQuery.length, isAllPatients, log);

  const fileName = csvName(orgName);
  initCsv(fileName);

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

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  isAllPatients: boolean,
  log: typeof console.log
) {
  const msgForAllPatients = `You are about to get the coverage info of ALL patients of the CX (${patientCount}). This can be expensive.`;
  const msgForFewPatients = `You are about to get the coverage info of ${patientCount} patients of the CX.`;
  const msg = isAllPatients ? msgForAllPatients : msgForFewPatients;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
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
