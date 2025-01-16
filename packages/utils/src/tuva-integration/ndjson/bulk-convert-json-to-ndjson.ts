import { Bundle, Resource } from "@medplum/fhirtypes";
import { getFileNames, makeDir } from "@metriport/core/src/util/fs";
import fs from "fs";
import path from "path";

/**
 * Converts all files in the input directory to NDJSON, and creates a folder containing an .ndjson file for each of the resources specified in `resourceTypes`.
 *
 * Use this when you need input files for the FHIR inferno to generate new Metriport Config files.
 * Note: this will mix the resources from all Consolidated Bundles it finds into one pool of data, split into individual files by the `resourceType`.
 *
 * @link - FHIR Inferno repo - https://github.com/metriport/FHIR_inferno
 * @link - Notion doc - https://www.notion.so/metriport/Tuva-Integration-177b51bb90408066ba6ae29cbb572c86
 *
 */

interface ConversionResult {
  fileName: string;
  success: boolean;
  error?: string;
}

const inputDir = "";

const resourceTypes = [
  "AllergyIntolerance",
  "Condition",
  "Coverage",
  "DiagnosticReport",
  "DocumentReference",
  "Encounter",
  "FamilyMemberHistory",
  "Observation",
  "Organization",
  "Patient",
  "Immunization",
  "MedicationStatement",
  "MedicationRequest",
  "MedicationAdministration",
  "MedicationDispense",
  "Medication",
  "Practitioner",
  "Procedure",
];

type ResourceMap = {
  [key: string]: Resource[];
};

function processFile(filePath: string, resourceMap: ResourceMap): ConversionResult {
  const fileName = path.basename(filePath);
  try {
    const rawContents = fs.readFileSync(filePath, "utf-8");
    const bundle = JSON.parse(rawContents) as Bundle<Resource>;

    if (!bundle.entry) {
      throw new Error("No entries found in bundle");
    }

    for (const resourceType of resourceTypes) {
      const currentResources = bundle.entry
        ?.filter(r => r.resource?.resourceType === resourceType)
        .map(r => r.resource as Resource);

      if (currentResources.length > 0) {
        resourceMap[resourceType] = resourceMap[resourceType] ?? [];
        resourceMap[resourceType].push(...currentResources);
      }
    }

    return { fileName, success: true };
  } catch (error) {
    return {
      fileName,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

function convertFolder(inputDir: string): ConversionResult[] {
  const outputDir = path.join(path.dirname(inputDir), "ndjson_outputs");
  if (!fs.existsSync(outputDir)) {
    makeDir(outputDir);
  }

  const jsonFiles = getFileNames({ folder: inputDir, extension: ".json", recursive: true });

  // Accumulate all resources by type
  const resourceMap: ResourceMap = {};
  const results = jsonFiles.map(filePath => processFile(filePath, resourceMap));

  // Write each resource type to its file
  resourceTypes.forEach(resourceType => {
    const filePath = path.join(outputDir, `${resourceType}.ndjson`);
    const resources = resourceMap[resourceType] ?? [];
    const content = resources.map(r => JSON.stringify(r)).join("\n");
    fs.writeFileSync(filePath, content);
  });

  return results;
}

function main(): void {
  const results = convertFolder(inputDir);

  // Log results
  console.log("\nConversion Results:");
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.fileName}: Successfully converted`);
    } else {
      console.log(`❌ ${result.fileName}: Failed - ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`\nSummary: ${successCount} succeeded, ${failureCount} failed`);
}

main();
