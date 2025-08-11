import fs from "fs";
import path from "path";
import { Command } from "commander";
import { Bundle } from "@medplum/fhirtypes";
import { parseResponseFile } from "@metriport/core/external/quest/file/file-parser";
import { ResponseDetail } from "@metriport/core/external/quest/schema/response";
import { IncomingData } from "@metriport/core/external/quest/schema/shared";
import { convertBatchResponseToFhirBundles } from "@metriport/core/external/quest/fhir-converter";

/**
 * This script is used to analyze the Quest data.
 * It will:
 * 1. Parse the Quest data
 * 2. Convert the Quest data to FHIR bundles
 * 3. Write the FHIR bundles to the Quest directory
 * 4. Print statistics about the found patients
 * 5. Print statistics about the FHIR bundles
 */
const command = new Command();

const QUEST_DIR = path.join(__dirname, "../..", "runs", "quest");

command
  .name("analysis")
  .option("--cx-name <cxName>", "The customer name")
  .description("Analysis of Quest data")
  .action(runAnalysis);

async function runAnalysis({ cxName }: { cxName: string }) {
  if (!cxName) {
    throw new Error("Customer name is required");
  }
  // Collect statistics about the found patients
  const foundPatientIds = new Set();
  const countPatient: Record<string, number> = {};

  const cxDir = path.join(QUEST_DIR, cxName);
  const patientIdMap = getQuestPatientMapping(cxDir);
  const patientIds = new Set(Object.keys(patientIdMap));
  const mapToMetriportId = Object.fromEntries(Object.entries(patientIdMap).map(([k, v]) => [v, k]));
  const files = fs.readdirSync(cxDir).filter(file => file.endsWith(".txt"));
  const allDetails: IncomingData<ResponseDetail>[] = [];
  // Parse the files
  for (const file of files) {
    console.log("Processing " + file);
    const fileContent = fs.readFileSync(path.join(cxDir, file));
    const details = parseResponseFile(fileContent, mapToMetriportId);
    console.log("Received " + details.length + " rows");
    allDetails.push(...details);

    // Increment patient statistics
    for (const detail of details) {
      const patientId = detail.data.patientId;
      foundPatientIds.add(patientId);
      countPatient[patientId] = (countPatient[patientId] || 0) + 1;
    }
  }

  const bundles = await convertBatchResponseToFhirBundles(cxName, allDetails);

  for (const bundle of bundles) {
    writeQuestConversionBundle(cxName, bundle.patientId, bundle.bundle);
  }

  console.log("Total rows: " + allDetails.length);
  console.log("Total bundles: " + bundles.length);

  // Print statistics about the found patients
  console.log("found " + foundPatientIds.size + " patient ids");
  console.log("missing " + (patientIds.size - foundPatientIds.size) + " patient ids");
  console.log(
    "coverage percent: " + ((foundPatientIds.size / patientIds.size) * 100).toFixed(2) + "%"
  );

  const averageCount =
    Object.values(countPatient).reduce((a, b) => a + b, 0) / Object.keys(countPatient).length;
  console.log("average labs per patient: " + averageCount.toFixed(3));

  const maxCounts = Object.values(countPatient).sort((a, b) => b - a)[0];
  console.log("max labs per patient: " + maxCounts);

  const minCounts = Object.values(countPatient).sort((a, b) => a - b)[0];
  console.log("min labs per patient: " + minCounts);
}

function getQuestPatientMapping(dirPath: string): Record<string, string> {
  const fileContent = fs.readFileSync(path.join(dirPath, "job.json"), "utf8");
  const job = JSON.parse(fileContent);
  const patientIdMap = job.patientIdMap;
  return patientIdMap;
}

function writeQuestConversionBundle(cxName: string, patientId: string, bundle: Bundle) {
  const cxDir = path.join(QUEST_DIR, "quest", cxName);
  if (!fs.existsSync(cxDir)) {
    fs.mkdirSync(cxDir, { recursive: true });
  }
  const patientDir = path.join(cxDir, "patientId=" + patientId);
  if (!fs.existsSync(patientDir)) {
    fs.mkdirSync(patientDir, { recursive: true });
  }
  const filePath = path.join(patientDir, "latest.json");
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2));
}

export default command;
