import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentQuery, MetriportMedicalApi } from "@metriport/api-sdk";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getPatientIds } from "./patient/get-ids";
import { initFile } from "./shared/file";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { logErrorToFile } from "./shared/log";
import { cloneDeep } from "lodash";

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
const delayTime = dayjs.duration(5, "seconds");
const numberOfParallelExecutions = 10;
const confirmationTime = dayjs.duration(10, "seconds");

// output stuff
const csvHeader =
  "patientId,firstName,lastName,state,downloadStatus,docCount,convertStatus,fhirResourceCount,fhirResourceDetails\n";
const getOutputFileName = buildGetDirPathInside(`coverage-assessment`);
const patientsWithErrors: string[] = [];

const program = new Command();
program
  .name("coverage-assessment")
  .description("CLI to get coverage/density data multiple patients.")
  .showHelpAfterError();

async function main() {
  initRunsFolder();
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

  await displayWarningAndConfirmation(patientIdsToQuery.length, isAllPatients, orgName, log);

  const outputFileName = getOutputFileName(orgName) + ".csv";
  const errorFileName = getOutputFileName(orgName) + ".error";
  initFile(outputFileName, csvHeader);
  initFile(errorFileName);

  log(`>>> Running it...`);

  let ptIndex = 0;
  await executeAsynchronously(
    patientIdsToQuery,
    async patientId => {
      await getCoverageForPatient(patientId, outputFileName, errorFileName, log);
      log(`>>> Progress: ${++ptIndex}/${patientIdsToQuery.length} patients complete`);
      await sleep(delayTime.asMilliseconds());
    },
    { numberOfParallelExecutions }
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
  log(`>>> Done assessing coverage for all ${patientIdsToQuery.length} patients in ${ellapsed} ms`);
  process.exit(0);
}

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  isAllPatients: boolean,
  orgName: string,
  log: typeof console.log
) {
  const msgForAllPatients = `You are about to get the coverage info of ALL patients of the org/cx ${orgName} (${patientCount}). This can be expensive.`;
  const msgForFewPatients = `You are about to get the coverage info of ${patientCount} patients of the org/cx ${orgName}.`;
  const msg = isAllPatients ? msgForAllPatients : msgForFewPatients;
  log(msg);
  log("Cancel this now if you're not sure.");
  await sleep(confirmationTime.asMilliseconds());
}

async function getCoverageForPatient(
  patientId: string,
  outputFileName: string,
  errorFileName: string,
  log: typeof console.log
) {
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

    const resources = cloneDeep(fhir.resources);
    // Remove the Patient resource from the result
    const fhirCount = Math.max(fhir.total - 1, 0);
    delete resources.Patient;
    const fhirDetails = JSON.stringify(resources).replaceAll(",", " ");

    // "patientId,firstName,lastName,state,downloadStatus,docCount,convertStatus,fhirResourceCount,fhirResourceDetails\n";
    const csvRow = `${id},${firstName},${lastName},${state},${downloadStatus},${docCount},${convertStatus},${fhirCount},${fhirDetails}\n`;
    fs.appendFileSync(outputFileName, csvRow);
    log(`>>> Done doc query for patient ${patient.id}...`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = `ERROR processing patient ${patientId}: `;
    log(msg, error.message);
    patientsWithErrors.push(patientId);
    logErrorToFile(errorFileName, msg, error);
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
