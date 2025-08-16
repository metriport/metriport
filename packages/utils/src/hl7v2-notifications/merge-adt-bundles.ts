import * as dotenv from "dotenv";
dotenv.config();

// keep that ^ on top
import { mergeAdtBundles } from "@metriport/core/external/fhir/adt-encounters";
import { getFileContents, makeDir } from "@metriport/core/util/fs";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { buildDayJs } from "@metriport/shared/util/dayjs";
import { writeFileSync } from "fs";

/**
 * Folder with consolidated files/bundles. If the files need to be combined into a bundle
 * set createBundle, existingPatientId, and auth stuff.
 *
 * WARNING: this will overwrite the *_deduped.json files!!!
 */
const ptId = "";
const cxId = "";
const pathToData = "/Users/lucasdellabella/Documents/PHI";
const adtBundle1Path = `${pathToData}/admit.hl7.json`;
const adtBundle2Path = `${pathToData}/discharge.hl7.json`;

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
  const timestamp = buildDayJs().toISOString();
  const logsFolderName = `runs/merge-adt-bundles/${timestamp}`;

  makeDir(logsFolderName);

  const startedAt = new Date();
  console.log("Starting deduplication at ", startedAt);

  const adtBundle1 = await FhirBundleSdk.create(JSON.parse(getFileContents(adtBundle1Path)));
  const adtBundle2 = await FhirBundleSdk.create(JSON.parse(getFileContents(adtBundle2Path)));

  const resultBundle = mergeAdtBundles({
    cxId,
    patientId: ptId,
    existing: adtBundle1.toObject(),
    current: adtBundle2.toObject(),
  });

  const lastSlash = adtBundle1Path.lastIndexOf("/");
  const fileName = adtBundle1Path.slice(lastSlash + 1).split(".json")[0];
  const fileNameWithExtension = `${fileName}_merged.json`;

  const output = JSON.stringify(resultBundle);
  writeFileSync(`${logsFolderName}/${fileNameWithExtension}`, output);
}

main();
