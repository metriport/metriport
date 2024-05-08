import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ConsolidatedCountResponse, MetriportMedicalApi } from "@metriport/api-sdk";
import { DetailedConfig } from "@metriport/core/domain/document-query/trigger-and-query";
import { TriggerAndQueryDocRefsRemote } from "@metriport/core/domain/document-query/trigger-and-query-remote";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/core/util/sleep";
import axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { chunk } from "lodash";
import path from "path";
import { getFileNameForOrg } from "./shared/folder";
import { getCxData } from "./shared/get-cx-data";

dayjs.extend(duration);

/**
 * This script kicks off document queries in bulk for the configured cx.
 *
 * This is expensive!
 *
 * Make sure to update the `patientIds` with the list of Patient IDs you
 * want to trigger document queries for, otherwise it will do it for all
 * Patients of the respective customer.
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
});

// query stuff
const delayTime = dayjs.duration(30, "seconds");
const patientChunkSize = parseInt(getEnvVar("PATIENT_CHUNK_SIZE") ?? "10");
const detailedConfig: DetailedConfig = {
  patientChunkDelayJitterMs: parseInt(getEnvVar("PATIENT_CHUNK_DELAY_JITTER_MS") ?? "1000"),
  queryPollDurationMs: 10_000,
  maxQueryDurationMs: 71_000, // CW has a 70s timeout, so this is the maximum duration any doc query can take
  maxDocQueryAttempts: 3,
  minDocsToConsiderCompleted: 2,
};
const confirmationTime = dayjs.duration(10, "seconds");

// csv stuff
const csvHeader =
  "patientId,firstName,lastName,state,queryAttemptCount,docCount,fhirResourceCount,fhirResourceDetails,status\n";

const csvName = (cxName: string): string => `./runs/DocQuery/${getFileNameForOrg(cxName, "csv")}`;

const triggerAndQueryDocRefs = new TriggerAndQueryDocRefsRemote(apiUrl);

function initCsv(fileName: string) {
  const dirName = path.dirname(fileName);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  fs.writeFileSync(fileName, csvHeader);
}

async function getPatientIds(dryRun: boolean, log: typeof console.log): Promise<string[]> {
  if (patientIds.length > 0) {
    if (!dryRun) {
      displayNoDryRunWarning(log);
      log("Cancel this script now if you're not sure.");
      await sleep(confirmationTime.asMilliseconds());
    }
    return patientIds;
  }
  return await getAllPatientIds(dryRun, log);
}

async function getAllPatientIds(dryRun: boolean, log: typeof console.log): Promise<string[]> {
  if (!dryRun) {
    displayNoDryRunWarning(log);
    log(
      "You are about to trigger a document query for all patients of the CX. This is very expensive!"
    );
    log("Cancel this script now if you're not sure.");
    await sleep(confirmationTime.asMilliseconds());
  }
  const resp = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  const patientIds = resp.data.patientIds;
  return (Array.isArray(patientIds) ? patientIds : []) as string[];
}

function displayNoDryRunWarning(log: typeof console.log) {
  // The first chars there are to set color red on the terminal
  // See: // https://stackoverflow.com/a/41407246/2099911
  log("\n\x1b[31m%s\x1b[0m\n", "---- ATTENTION - THIS IS NOT A SIMULATED RUN ----");
}

async function queryDocsForPatient(
  patientId: string,
  fileName: string,
  dryRun: boolean,
  log: typeof console.log
) {
  try {
    let docCount = 0;
    let totalFhirResourceCount = 0;
    let status: "completed" | "docs-not-found" = "docs-not-found";
    let fhirResourceTypesToCounts: ConsolidatedCountResponse = {
      filter: { resources: "" },
      resources: {},
      total: 0,
    };
    const docQueryPromise = async () =>
      triggerAndQueryDocRefs.queryDocsForPatient({
        cxId,
        patientId,
        triggerWHNotificationsToCx,
        config: detailedConfig,
        log,
      });
    const getPatientPromise = async () => metriportAPI.getPatient(patientId);

    if (dryRun) {
      const patient = await getPatientPromise();
      log(
        `Would be triggering the DQ for patient ${patient.id} ` +
          `${patient.firstName} ${patient.lastName}...`
      );
      return;
    }

    const [patient, docQueryResult] = await Promise.all([getPatientPromise(), docQueryPromise()]);
    const { queryComplete, docQueryAttempts } = docQueryResult;

    if (queryComplete) {
      status = "completed";
      // get count of resulting FHIR resources
      fhirResourceTypesToCounts = await metriportAPI.countPatientConsolidated(patientId);
      // get total doc refs for the patient
      const docRefs = await metriportAPI.listDocuments(patientId);
      docCount = docRefs.documents.length;
      for (const val of Object.values(fhirResourceTypesToCounts.resources)) {
        totalFhirResourceCount += val;
      }
    }

    // write line to results csv
    const state = Array.isArray(patient.address) ? patient.address[0].state : patient.address.state;
    fs.appendFileSync(
      fileName,
      `${patient.id},${patient.firstName},${
        patient.lastName
      },${state},${docQueryAttempts},${docCount},${totalFhirResourceCount},${JSON.stringify(
        fhirResourceTypesToCounts
      ).replaceAll(",", " ")},${status}\n`
    );
    log(`>>> Done doc query for patient ${patient.id} with status ${status}...`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log(`ERROR processing patient ${patientId}: `, error.message);
  }
}

type Params = {
  dryrun?: boolean;
};
const program = new Command();
program
  .name("bulk-query-patients")
  .description("CLI to trigger Document Queries for multiple patients.")
  .option(`--dryrun`, "Just simulate DQ without actually triggering it.")
  .showHelpAfterError();

async function main() {
  program.parse();
  const { dryrun: dryRunParam } = program.opts<Params>();
  const dryRun = dryRunParam ?? false;
  const { log } = out(dryRun ? "DRY-RUN" : "");

  const startedAt = Date.now();
  log(`>>> Starting with ${patientIds.length} patient IDs...`);
  const { orgName } = await getCxData(cxId, undefined, false);
  const fileName = csvName(orgName);

  initCsv(fileName);

  const patientIdsToQuery = await getPatientIds(dryRun, log);
  log(`>>> Running it...`);
  const chunks = chunk(patientIdsToQuery, patientChunkSize);

  let count = 0;
  // TODO move to core's executeAsynchronously()
  for (const chunk of chunks) {
    log(`>>> Querying docs for chunk of ${chunk.length} patient from ${orgName}...`);
    const docQueries: Promise<void>[] = [];
    for (const patientId of chunk) {
      docQueries.push(queryDocsForPatient(patientId, fileName, dryRun, log));
      count++;
    }
    await Promise.allSettled(docQueries);

    log(`>>> Progress: ${count + 1}/${patientIdsToQuery.length} patient doc queries complete`);
    log(`>>> Sleeping for ${delayTime.asMilliseconds()} ms before the next chunk...`);
    await sleep(delayTime.asMilliseconds());
  }

  log(`>>> Done querying docs for all patients in ${Date.now() - startedAt} ms`);
  process.exit(0);
}

main();
