import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getFileContents, getFileNames } from "../shared/fs";

/**
 * Takes all the JSON files from the specified folder, and normalizes them, storing the result in the same folder, with the `_normalized` suffix.
 *
 * WARNING: this will overwrite the *_normalized.json files!!!
 */
const samplesFolderPath = "";

const suffix = "_normalized";

async function main() {
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });
  const filteredBundleFileNames = bundleFileNames.filter(f => !f.includes(suffix));

  await executeAsynchronously(filteredBundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${filteredBundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const bundle: Bundle = JSON.parse(stringBundle);

    const cxId = uuidv4();
    const patientId = uuidv4();
    const normalizedBundle = await normalize({
      cxId,
      patientId,
      bundle,
    });

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(normalizedBundle);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

main();
