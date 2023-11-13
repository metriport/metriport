import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ConsolidatedCountResponse, MetriportMedicalApi } from "@metriport/api-sdk";
import { DetailedConfig } from "@metriport/core/domain/document-query/trigger-and-query";
import { TriggerAndQueryDocRefsRemote } from "@metriport/core/domain/document-query/trigger-and-query-remote";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { sleep } from "@metriport/core/util/sleep";
import axios from "axios";
import fs from "fs";
import { chunk } from "lodash";

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
const cxName = getEnvVarOrFail("CX_NAME");
const apiKey = getEnvVarOrFail("API_KEY");
const apiUrl = getEnvVarOrFail("API_URL");
const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

// query stuff
const delayTime = parseInt(getEnvVar("BULK_QUERY_DELAY_TIME") ?? "5000");
const patientChunkSize = parseInt(getEnvVar("PATIENT_CHUNK_SIZE") ?? "25");
const detailedConfig: DetailedConfig = {
  patientChunkDelayJitterMs: parseInt(getEnvVar("PATIENT_CHUNK_DELAY_JITTER_MS") ?? "1000"),
  queryPollDurationMs: 10_000,
  maxQueryDurationMs: 71_000, // CW has a 70s timeout, so this is the maximum duration any doc query can take
  maxDocQueryAttempts: 3,
  minDocsToConsiderCompleted: 2,
};

// csv stuff
const csvHeader =
  "patientId,firstName,lastName,state,queryAttemptCount,docCount,fhirResourceCount,fhirResourceDetails,status\n";
const curDateTime = new Date();
const csvName = `./${replaceAll(cxName, " ", "").trim()}-DocQuery-${curDateTime.toISOString()}.csv`;

const triggerAndQueryDocRefs = new TriggerAndQueryDocRefsRemote(apiUrl);

function replaceAll(string: string, search: string, replace: string): string {
  return string.split(search).join(replace);
}

function initCsv() {
  fs.writeFileSync(csvName, csvHeader);
}

async function getAllPatientIds(): Promise<string[]> {
  const resp = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  const patientIds = resp.data.patientIds;
  return (Array.isArray(patientIds) ? patientIds : []) as string[];
}

async function queryDocsForPatient(patientId: string) {
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
        log: console.log,
      });

    const getPatientPromise = async () => metriportAPI.getPatient(patientId);
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
      csvName,
      `${patient.id},${patient.firstName},${
        patient.lastName
      },${state},${docQueryAttempts},${docCount},${totalFhirResourceCount},${replaceAll(
        JSON.stringify(fhirResourceTypesToCounts),
        ",",
        " "
      )},${status}\n`
    );
    console.log(`>>> Done doc query for patient ${patient.id} with status ${status}...`);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`ERROR processing patient ${patientId}: `, error.message);
  }
}

async function main() {
  const startedAt = Date.now();
  initCsv();
  console.log(`>>> Starting with ${patientIds.length} patient IDs...`);

  const patientIdsToQuery = patientIds.length > 0 ? patientIds : await getAllPatientIds();
  const chunks = chunk(patientIdsToQuery, patientChunkSize);

  let count = 0;
  // TODO move to core's executeAsynchronously()
  for (const chunk of chunks) {
    console.log(`>>> Querying docs for chunk of ${chunk.length} patients...`);
    const docQueries: Promise<void>[] = [];
    for (const patientId of chunk) {
      docQueries.push(queryDocsForPatient(patientId));
      count++;
    }
    await Promise.allSettled(docQueries);

    console.log(
      `>>> Progress: ${count + 1}/${patientIdsToQuery.length} patient doc queries complete`
    );
    console.log(`>>> Sleeping for ${delayTime} ms before the next chunk...`);
    await sleep(delayTime);
  }

  console.log(`>>> Done querying docs for all patients in ${Date.now() - startedAt} ms`);
}

main();
