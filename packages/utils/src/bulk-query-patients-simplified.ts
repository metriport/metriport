import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { DocumentQuery, MetriportMedicalApi } from "@metriport/api-sdk";
import { disableWHMetadata } from "@metriport/core/domain/document-query/trigger-and-query";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import { getPatientIds } from "./patient/get-ids";
import { getDelayTime } from "./shared/duration";
import { initFile } from "./shared/file";
import { buildGetDirPathInside, initRunsFolder } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";
import { logErrorToFile, logNotDryRun } from "./shared/log";

dayjs.extend(duration);

/**
 * This script kicks off document queries in bulk for the configured cx.
 *
 * This is expensive!
 *
 * Make sure to update the `patientIds` with the list of Patient IDs you
 * want to trigger document queries for, otherwise it will do it for all
 * Patients of the respective customer.
 *
 * This is a simplified/leaner version of bulk-query-patients.ts.
 * - this: just triggers the DQ
 * - bulk-query-patients: triggers the DQ, waits for it to complete, and logs the results
 *
 * This supports updating the delay time in-flight, by editing the delay-time-in-seconds.txt file.
 * @see shared/duration.ts for more details
 *
 * Execute this with:
 * $ ts-node src/bulk-query-patients-simplified.ts -- --dryrun
 * $ ts-node src/bulk-query-patients-simplified.ts
 */

// add patient IDs here to kick off queries for specific patient IDs
const patientIds: string[] = [];

// If you're sure we want to trigger WH notifications to the CX, enable this
const triggerWHNotificationsToCx = false;

// auth stuff
const cxId = getEnvVarOrFail("CX_ID");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
  timeout: 120_000,
});
const apiInternal = axios.create({
  baseURL: apiUrl,
  timeout: 120_000,
});

// query stuff
const minimumDelayTime = dayjs.duration(3, "seconds");
const defaultDelayTime = dayjs.duration(10, "seconds");
const patientChunkSize = parseInt(getEnvVar("PATIENT_CHUNK_SIZE") ?? "1");
const confirmationTime = dayjs.duration(10, "seconds");

// output stuff
const csvHeader =
  "patientId,firstName,lastName,state,queryAttemptCount,docCount,fhirResourceCount,fhirResourceDetails,status\n";
const getOutputFileName = buildGetDirPathInside(`bulk-query`);
const patientsWithErrors: string[] = [];

async function displayWarningAndConfirmation(
  patientCount: number | undefined,
  isAllPatients: boolean,
  orgName: string,
  dryRun: boolean,
  log: typeof console.log
) {
  const msgForAllPatients = `You are about to trigger a document query for ALL patients of the org/cx ${orgName} (${patientCount}). This is very expensive!`;
  const msgForFewPatients = `You are about to trigger a document query for ${patientCount} patients of the org/cx ${orgName}. This can be expensive!`;
  const msg = isAllPatients ? msgForAllPatients : msgForFewPatients;
  if (!dryRun) logNotDryRun(log);
  log(msg);
  log("Cancel this now if you're not sure.");
  if (!dryRun) await sleep(confirmationTime.asMilliseconds());
}

async function queryDocsForPatient(
  patientId: string,
  outputFileName: string,
  errorFileName: string,
  dryRun: boolean,
  log: typeof console.log
) {
  try {
    const docQueryPromise = async () =>
      triggerDocQuery(cxId, patientId, triggerWHNotificationsToCx);
    const getPatientPromise = async () => metriportAPI.getPatient(patientId);

    if (dryRun) {
      const patient = await getPatientPromise();
      log(
        `Would be triggering the DQ for patient ${patient.id} ` +
          `${patient.firstName} ${patient.lastName}...`
      );
      return;
    }

    await docQueryPromise();

    fs.appendFileSync(outputFileName, `${patientId}\n`);
    log(`>>> Done triggering doc query for patient ${patientId}...`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = `ERROR processing patient ${patientId}: `;
    log(msg, error.message);
    patientsWithErrors.push(patientId);
    fs.appendFileSync(outputFileName + "_error.txt", `${patientId}\n`);
    logErrorToFile(errorFileName, msg, error);
  }
}

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("bulk-query-patients-simplified")
  .description("CLI to trigger Document Queries for multiple patients.")
  .option(`--dryrun`, "Just simulate DQ without actually triggering it.")
  .showHelpAfterError();

/*****************************************************************************
 *                                MAIN
 *****************************************************************************/
async function main() {
  initRunsFolder();
  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;
  const { log } = out(dryRun ? "DRY-RUN" : "");

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);

  const { orgName } = await getCxData(cxId, undefined, false);
  const { patientIds: patientIdsToQuery, isAllPatients } = await getPatientIds({
    cxId,
    patientIds,
    axios,
  });

  await displayWarningAndConfirmation(
    patientIdsToQuery.length,
    isAllPatients,
    orgName,
    dryRun,
    log
  );

  const outputFileName = getOutputFileName(orgName) + ".csv";
  const errorFileName = getOutputFileName(orgName) + ".error";
  if (!dryRun) {
    initFile(outputFileName, csvHeader);
    initFile(errorFileName);
  }

  log(`>>> Running it... (delay time is ${localGetDelay(log)} ms)`);

  let count = 0;
  const chunks = chunk(patientIdsToQuery, patientChunkSize);
  for (const [i, chunk] of Object.entries(chunks)) {
    log(`>>> Querying docs for chunk of ${chunk.length} patient from ${orgName}...`);
    const docQueries: Promise<void>[] = [];
    for (const patientId of chunk) {
      docQueries.push(queryDocsForPatient(patientId, outputFileName, errorFileName, dryRun, log));
      count++;
    }
    await Promise.allSettled(docQueries);

    log(`>>> Progress: ${count}/${patientIdsToQuery.length} patient doc queries complete`);

    if (parseInt(i) < chunks.length - 1) {
      const delayTime = localGetDelay(log);
      log(`... ... sleeping for ${delayTime} ms before the next chunk...`);
      await sleep(delayTime);
    }
  }

  if (patientsWithErrors.length > 0) {
    log(
      `>>> Patients with errors (${patientsWithErrors.length}): ${patientsWithErrors.join(", ")}`
    );
    log(`>>> See file ${errorFileName} for more details.`);
  } else {
    log(`>>> No patient with errors!`);
  }
  log(`>>> Done querying docs for all patients in ${Date.now() - startedAt} ms`);
  process.exit(0);
}

function localGetDelay(log: typeof console.log) {
  return getDelayTime({ log, minimumDelayTime, defaultDelayTime });
}

async function triggerDocQuery(
  cxId: string,
  patientId: string,
  triggerWHNotifs: boolean
): Promise<DocumentQuery | undefined> {
  const payload = triggerWHNotifs ? {} : { metadata: disableWHMetadata };
  const resp = await apiInternal.post(
    `/internal/docs/query?cxId=${cxId}&patientId=${patientId}`,
    payload
  );
  return resp.data.documentQueryProgress ?? undefined;
}

main();
