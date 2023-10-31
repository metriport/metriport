import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ConsolidatedCountResponse, MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
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
const patientChunkDelayJitterMs = parseInt(getEnvVar("PATIENT_CHUNK_DELAY_JITTER_MS") ?? "1000");
const queryPollDurationMs = 10_000;
const maxQueryDurationMs = 71_000; // CW has a 70s timeout, so this is the maximum duration any doc query can take
const maxDocQueryAttemts = 3;
/**
 * If the doc query returns less than this, we want to query again to try and get better
 * coverage. Had situation where we requeried a patient w/ 1 doc ref and it jumped from
 * 1 to 20.
 */
const minDocsToConsiderCompleted = 2;

// csv stuff
const csvHeader =
  "patientId,firstName,lastName,state,queryAttemptCount,docCount,fhirResourceCount,fhirResourceDetails,status\n";
const curDateTime = new Date();
const csvName = `./${replaceAll(cxName, " ", "").trim()}-DocQuery-${curDateTime.toISOString()}.csv`;

function replaceAll(string: string, search: string, replace: string): string {
  return string.split(search).join(replace);
}

function initCsv() {
  fs.writeFileSync(csvName, csvHeader);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllPatientIds(): Promise<string[]> {
  const resp = await axios.get(`${apiUrl}/internal/patient/ids?cxId=${cxId}`);
  const patientIds = resp.data.patientIds;
  return (Array.isArray(patientIds) ? patientIds : []) as string[];
}

async function queryDocsForPatient(patientId: string) {
  try {
    let docQueryAttempts = 0;
    let docCount = 0;
    let totalFhirResourceCount = 0;
    let status: "completed" | "docs-not-found" = "docs-not-found";
    let queryComplete = false;
    let fhirResourceTypesToCounts: ConsolidatedCountResponse = {
      filter: { resources: "" },
      resources: {},
      total: 0,
    };
    const docQueryPromise = async () => {
      while (docQueryAttempts < maxDocQueryAttemts) {
        console.log(`>>> Starting doc query for patient ${patientId}...`);
        await metriportAPI.startDocumentQuery(patientId);
        // add a bit of jitter to the requests
        await sleep(200 + Math.random() * patientChunkDelayJitterMs);
        const queryStartTime = Date.now();
        while (Date.now() - queryStartTime < maxQueryDurationMs) {
          const docQueryStatus = await metriportAPI.getDocumentQueryStatus(patientId);
          if (
            docQueryStatus.download &&
            docQueryStatus.download.total &&
            docQueryStatus.download.total >= minDocsToConsiderCompleted
          ) {
            queryComplete = true;
            break;
          }
          await sleep(queryPollDurationMs);
        }
        docQueryAttempts++;
        if (queryComplete) break;
        console.log(
          `>>> Didn't find docs for patient ${patientId} on attempt ${docQueryAttempts}...`
        );
      }
    };
    const getPatientPromise = async () => metriportAPI.getPatient(patientId);
    const [patient] = await Promise.all([getPatientPromise(), docQueryPromise()]);

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
