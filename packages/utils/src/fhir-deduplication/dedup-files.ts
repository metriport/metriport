import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { deduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import fs from "fs";
import { getFileContents, getFileNames, makeDir } from "../shared/fs";
import { validateReferences } from "./report/validate-references";

/**
 * Folder with consolidated files/bundles.
 *
 * WARNING: this will overwrite the *_deduped.json files!!!
 */
const samplesFolderPath = ``;

const suffix = "_deduped";

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
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });
  const filteredBundleFileNames = bundleFileNames.filter(f => !f.includes(suffix));

  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/dedup/${timestamp}`;

  makeDir(logsFolderName);

  await executeAsynchronously(filteredBundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${filteredBundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const initialBundle: Bundle = JSON.parse(stringBundle);

    const startedAt = new Date();

    const resultingBundle = deduplicateFhir(initialBundle);

    console.log(
      `Went from ${initialBundle.entry?.length} to ${
        resultingBundle.entry?.length
      } resources in ${elapsedTimeFromNow(startedAt)} ms.`
    );

    const resources =
      resultingBundle.entry?.map(entry => entry.resource).filter((r): r is Resource => !!r) ?? [];
    const isValid = validateReferences(resources, logsFolderName);
    console.log(`Reference validation result: ${isValid ? "Valid" : "Invalid"}`);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(resultingBundle);
    fs.writeFileSync(`./${logsFolderName}/${fileNameWithExtension}`, output);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

main();
