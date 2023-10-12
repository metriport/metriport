/**
 * This script kicks off document queries in bulk for the configured cx.
 */

import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { ConsolidatedCountResponse, MetriportMedicalApi, Patient } from "@metriport/api-sdk";
import fs from "fs";
import { getEnvVar, getEnvVarOrFail } from "./shared/env";

// auth stuff
const apiKey = getEnvVarOrFail("API_KEY");
const facilityId = getEnvVarOrFail("FACILITY_ID");
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
// add patient IDs here to kick off queries for specific patient IDs
const patientWhitelist: string[] = [];

// csv stuff
const cxName = getEnvVarOrFail("CX_NAME");
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

async function queryDocsForPatient(patient: Patient) {
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
  while (docQueryAttempts < maxDocQueryAttemts) {
    console.log(`>>> Starting doc query for patient ${patient.id}...`);
    await metriportAPI.startDocumentQuery(patient.id, patient.facilityIds[0]);
    // add a bit of jitter to the requests
    await sleep(200 + Math.random() * patientChunkDelayJitterMs);
    const queryStartTime = Date.now();
    while (Date.now() - queryStartTime < maxQueryDurationMs) {
      const docQueryStatus = await metriportAPI.getDocumentQueryStatus(patient.id);
      // ensure at least 1 doc was returned
      if (
        docQueryStatus.download &&
        docQueryStatus.download.total &&
        docQueryStatus.download.total > 0
      ) {
        queryComplete = true;
        break;
      }
      await sleep(queryPollDurationMs);
    }
    docQueryAttempts++;
    if (queryComplete) break;
    console.log(`>>> Didn't find docs for patient ${patient.id} on attmept ${docQueryAttempts}...`);
  }
  if (queryComplete) {
    status = "completed";
    // get count of resulting FHIR resources
    fhirResourceTypesToCounts = await metriportAPI.countPatientConsolidated(patient.id);
    // get total doc refs for the patient
    const docRefs = await metriportAPI.listDocuments(patient.id);
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
}

async function main() {
  initCsv();
  console.log(`>>> Getting all patients for facility ${facilityId}...`);
  const patients = await metriportAPI.listPatients(facilityId);

  console.log(`>>> Found ${patients.length} patients`);
  if (patientWhitelist.length > 0) {
    console.log(
      `... but will only query for the ${patientWhitelist.length} patients specified in the whitelist`
    );

    // remove patients not in the whitelist
    let i = patients.length;
    while (i--) {
      if (!patientWhitelist.includes(patients[i].id)) {
        patients.splice(i, 1);
      }
    }
  }
  for (const patient of patients) {
    console.log(patient.id);
  }

  for (let i = 0; i < patients.length; i += patientChunkSize) {
    const chunk = patients.slice(i, i + patientChunkSize);
    console.log(`>>> Querying docs for chunk of ${chunk.length} patients...`);
    const docQueries: Promise<void>[] = [];
    for (const patient of chunk) {
      docQueries.push(queryDocsForPatient(patient));
    }
    await Promise.allSettled(docQueries);

    console.log(`>>> Progress: ${i + 1}/${patients.length} patient doc queries complete`);
    console.log(`>>> Sleeping for ${delayTime} ms before the next chunk...`);
    await new Promise(f => setTimeout(f, delayTime));
  }
}

main();
