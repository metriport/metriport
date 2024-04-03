// This script is used to process all of a customers patients through a snomed filtering pipeline, and
// then generate MR summaries and CSV files from the resulting bundles
// The script makes consolidated queries, inserts a patient FHIR resource, and then calls the filtering
// and MR generation logic.

import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-snomed";
import fs from "fs/promises";
import { convertHtmlTablesToCsv } from "./convert-html-to-csv";
import * as path from "path";
import { fullProcessing } from "../terminology-server/snomed-dedup-and-filter";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import * as dotenv from "dotenv";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dotenv.config();
dayjs.extend(duration);

const apiKey = getEnvVarOrFail("API_KEY");
const apiLoadBalancerURL = getEnvVarOrFail("API_URL");
const fhirUrl = getEnvVarOrFail("FHIR_URL");
const cxId = getEnvVarOrFail("CX_ID");
const metriportApi: MetriportMedicalApi = new MetriportMedicalApi(apiKey);

const timestamp = dayjs().toISOString();
const resultsDirectory = `./runs/consolidatedPatients/${timestamp}`;

async function fetchPatientIds(cxId: string): Promise<string[]> {
  const url = `${apiLoadBalancerURL}/internal/patient/ids?cxId=${cxId}`;
  try {
    const response = await axios.get(url);
    return response.data.patientIds;
  } catch (error) {
    console.error(`Error fetching patient IDs:`, error);
    return [];
  }
}

//eslint-disable-next-line
async function getFhirPatientData(patientId: string): Promise<any> {
  const url = `${fhirUrl}/fhir/${cxId}/Patient/${patientId}/`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching FHIR data for patient ${patientId}:`, error);
  }
}

export async function ensureDirectory(): Promise<void> {
  await fs.mkdir(resultsDirectory, { recursive: true });
}

async function fetchAndSavePatientData(patientId: string): Promise<void> {
  try {
    const resources = ["Conditions, Procedures, MedicationAdministration"];
    const data = await metriportApi.getPatientConsolidated(patientId, resources);
    const fhirPatient = await getFhirPatientData(patientId);
    const resourceWrappedFhirPatient = { resource: fhirPatient };
    if (!data.entry) {
      data.entry = [];
    }
    data.entry.push(resourceWrappedFhirPatient);
    const filePath = `${resultsDirectory}/${patientId}.json`;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved for patient ${patientId}`);
  } catch (error) {
    console.error(`Error fetching and saving data for patient ${patientId}:`, error);
  }
}

async function processPatients(): Promise<void> {
  console.log("Checking if directory exists...");
  await ensureDirectory();
  console.log("Fetching patient IDs...");
  const patientIds = await fetchPatientIds(cxId);
  for (const patientId of patientIds) {
    await fetchAndSavePatientData(patientId);
  }
  console.log("All patient data processed.");
}

async function processFile(filePath: string) {
  await fullProcessing(filePath);

  const bundle = await fs.readFile(filePath, "utf8");
  const bundleParsed = JSON.parse(bundle);

  const html = bundleToHtml(bundleParsed);
  const htmlOutputFilePath = filePath.replace(".json", ".html");
  await fs.writeFile(htmlOutputFilePath, html);
  console.log(`HTML file created at ${htmlOutputFilePath}`);

  const csvContent = convertHtmlTablesToCsv(html);
  const csvOutputFilePath = filePath.replace(".json", ".csv");
  await fs.writeFile(csvOutputFilePath, csvContent);
  console.log(`CSV file created at ${csvOutputFilePath}`);
}

async function main() {
  await processPatients();

  const files = await fs.readdir(resultsDirectory);
  for (const file of files) {
    const fullPath = path.join(resultsDirectory, file);
    if (path.extname(fullPath) === ".json") {
      console.log(`Processing file ${fullPath}`);
      await processFile(fullPath);
    }
  }
}

main();
