import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource, Patient } from "@medplum/fhirtypes";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  buildConsolidatedBundle,
  merge,
} from "@metriport/core/command/consolidated/consolidated-create";
import { toFHIR as patientToFhir } from "@metriport/core/external/fhir/patient/conversion";
import { buildBundleEntry } from "@metriport/core/external/fhir/shared/bundle";
import { deduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents, getFileNames, makeDir } from "@metriport/core/util/fs";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { validateReferences } from "./report/validate-references";

/**
 * Folder with consolidated files/bundles. If the files need to be combined into a bundle
 * set createBundle, existingPatientId, and auth stuff.
 *
 * WARNING: this will overwrite the *_deduped.json files!!!
 */
const samplesFolderPath = "/Users/lucasdellabella/Documents/PHI/consolidated-bundles/";
const useDefaultPatient = true;
const suffix = "_deduped";

const createBundle = false;
const existingPatientId = "";
// auth stuff

/**
 * Read FHIR bundles from 'samplesFolderPath' and deduplicates the resources inside those bundles.
 *
 * Stores the output in:
 * - the source folder, with the same name and the suffix '_deduped.json'
 * - a the './runs/' folder, with the same name and the suffix '_deduped.json'
 *
 * WARNING: it will override the *_deduped.json files from the source folder!!!
 */
async function main() {
  console.log(
    `Running with createBundle = ${createBundle}${
      createBundle ? `and existingPatientId ${existingPatientId}` : ""
    }`
  );
  const filteredBundleFileNames = await createOrGetBundles(
    createBundle,
    createBundle ? existingPatientId : undefined
  );
  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/dedup/${timestamp}`;

  makeDir(logsFolderName);

  await executeAsynchronously(filteredBundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${filteredBundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const bundle: Bundle = JSON.parse(stringBundle);
    const initialSize = bundle.entry?.length;

    const startedAt = new Date();

    const cxId = uuidv4();
    const patientId = existingPatientId ?? uuidv4();
    deduplicateFhir(bundle, cxId, patientId);

    console.log(
      `Went from ${initialSize} to ${bundle.entry?.length} resources in ${elapsedTimeFromNow(
        startedAt
      )} ms.`
    );

    const resources =
      bundle.entry?.map(entry => entry.resource).filter((r): r is Resource => !!r) ?? [];
    const isValid = validateReferences(resources, logsFolderName);
    console.log(`Reference validation result: ${isValid ? "Valid" : "Invalid"}`);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(bundle);
    fs.writeFileSync(`./${logsFolderName}/${fileNameWithExtension}`, output);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

// Taken from core/command/consolidated/consolidated-create.ts
async function createOrGetBundles(createBundle: boolean, patientId?: string) {
  const fileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });
  if (!createBundle) {
    return fileNames.filter(f => !f.includes(suffix));
  }
  if (!patientId || patientId === "") {
    throw new Error("Patient ID is required when creating a bundle");
  }

  const fhirPatient = await getFhirPatient(patientId);

  const patientEntry = buildBundleEntry(fhirPatient);

  const mergedBundle = buildConsolidatedBundle();
  await executeAsynchronously(fileNames, async filePath => {
    console.log(`Getting conversion bundle from filePath ${filePath}`);
    const contents = getFileContents(filePath);
    console.log(`Merging bundle ${filePath} into the consolidated one`);
    const singleConversion = parseFhirBundle(contents);
    if (!singleConversion) {
      console.log(`No valid bundle found in ${filePath}, skipping`);
      return;
    }
    merge(singleConversion).into(mergedBundle);
  });

  const conversions = mergedBundle.entry ?? [];
  const withDups = buildConsolidatedBundle();
  withDups.entry = [...conversions, patientEntry]; // Missing ...docRefs.map(buildBundleEntry)
  withDups.total = withDups.entry.length;
  const bundleFileName = `${samplesFolderPath}/generatedBundle${patientId}`;
  fs.writeFileSync(bundleFileName, JSON.stringify(withDups));
  return [bundleFileName];
}

async function getFhirPatient(patientId: string): Promise<Patient> {
  if (useDefaultPatient) {
    return {
      resourceType: "Patient",
      id: patientId,
      name: [
        {
          family: "Zoidberg",
          given: ["John A."],
        },
      ],
      gender: "male",
    };
  }

  const apiKey = getEnvVarOrFail("API_KEY");
  const apiUrl = getEnvVarOrFail("API_URL");
  const metriportAPI = new MetriportMedicalApi(apiKey, {
    baseAddress: apiUrl,
  });
  const patient = await metriportAPI.getPatient(patientId);

  const fhirPatient = patientToFhir({
    id: patient.id,
    data: {
      ...patient,
      personalIdentifiers: [], // Typing fix -- not relevant for script
      address: [], // Typing fix -- not relevant for script
      contact: [], // Typing fix -- not relevant for script
    },
  });
  return fhirPatient;
}

main();
