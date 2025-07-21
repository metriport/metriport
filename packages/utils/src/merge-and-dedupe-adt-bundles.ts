import * as dotenv from "dotenv";
dotenv.config();

// keep that ^ on top
import { Patient, Resource } from "@medplum/fhirtypes";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  buildBundleEntry,
  buildCollectionBundle,
  dangerouslyAddEntriesToBundle,
} from "@metriport/core/external/fhir/bundle/bundle";
import { toFHIR as patientToFhir } from "@metriport/core/external/fhir/patient/conversion";
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents, getFileNames, makeDir } from "@metriport/core/util/fs";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { parseFhirBundle } from "@metriport/shared/medical";
import dayjs from "dayjs";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { cloneDeep } from "lodash";
import { lookForBrokenReferences } from "./fhir/fhir-deduplication/report/validate-references";

/**
 * Folder with consolidated files/bundles. If the files need to be combined into a bundle
 * set createBundle, existingPatientId, and auth stuff.
 *
 * WARNING: this will overwrite the *_deduped.json files!!!
 */
const samplesFolderPath = "/Users/lucasdellabella/Documents/PHI/investigate/";
const useDefaultPatient = true;
const suffix = "_deduped";

const createBundle = false;
const existingPatientId = "018e2e12-2f06-7d8e-8f67-62e739626377";

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
    const adtBundlePath = "/Users/lucasdellabella/Documents/PHI/adt-bundles/encounter.hl7 (1).json";
    const startedAt = new Date();
    const cxId = uuidv4();
    const patientId = existingPatientId ?? uuidv4();

    const consolidatedBundle = JSON.parse(getFileContents(filePath));
    dangerouslyDeduplicateFhir(consolidatedBundle, cxId, patientId);

    const adtBundle = await FhirBundleSdk.create(JSON.parse(getFileContents(adtBundlePath)));
    const joinedBundle = await (
      await FhirBundleSdk.create(consolidatedBundle)
    ).concatEntries(adtBundle);

    [joinedBundle].forEach(async bundle => {
      const initialSize = bundle.total;

      const resultBundle = cloneDeep(bundle.toObject());
      dangerouslyDeduplicateFhir(resultBundle, cxId, patientId);

      const { baseOnly, parameterOnly } = await bundle.diff(resultBundle);

      console.log(JSON.stringify(baseOnly.toString(), null, 2));
      console.log(JSON.stringify(parameterOnly.toString(), null, 2));

      console.log(
        `Went from ${initialSize} to ${
          resultBundle.entry?.length
        } resources in ${elapsedTimeFromNow(startedAt)} ms.`
      );

      const resources =
        resultBundle.entry?.map(entry => entry.resource).filter((r): r is Resource => !!r) ?? [];
      const isValid = lookForBrokenReferences(resources, logsFolderName);
      console.log(`Reference validation result: ${isValid ? "Valid" : "Invalid"}`);

      const lastSlash = filePath.lastIndexOf("/");
      const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
      const fileNameWithExtension = `${fileName}${suffix}.json`;

      const output = JSON.stringify(resultBundle);
      fs.writeFileSync(`./${logsFolderName}/${fileNameWithExtension}`, output);
      fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
    });
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

  const mergedBundle = buildCollectionBundle();
  await executeAsynchronously(fileNames, async filePath => {
    console.log(`Getting conversion bundle from filePath ${filePath}`);
    const contents = getFileContents(filePath);
    console.log(`Merging bundle ${filePath} into the consolidated one`);
    const singleConversion = parseFhirBundle(contents);
    if (!singleConversion) {
      console.log(`No valid bundle found in ${filePath}, skipping`);
      return;
    }
    dangerouslyAddEntriesToBundle(mergedBundle, singleConversion.entry);
  });

  const conversions = mergedBundle.entry ?? [];
  const withDups = buildCollectionBundle();
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
