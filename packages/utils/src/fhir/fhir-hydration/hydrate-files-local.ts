import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { hydrate } from "@metriport/core/external/fhir/consolidated/hydrate";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getFileContents, getFileNames } from "../shared/fs";
import { getEnvVarOrFail } from "@metriport/shared";

const termServerUrl = getEnvVarOrFail("TERM_SERVER_URL");

/**
 * Takes all the JSON files from the specified folder, and hydrates them, storing the result in the same folder, with the `_hydrated` suffix.
 *
 * WARNING: this will overwrite the *_hydrated.json files!!!
 */
const samplesFolderPath = "";

const suffix = "_hydrated";

async function main() {
  if (!termServerUrl) throw new Error("TERM_SERVER_URL has not been set.");

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

    const startedAt = new Date();

    const cxId = uuidv4();
    const patientId = uuidv4();
    const resultingBundle = await hydrate({ cxId, patientId, bundle });

    console.log(`Hydrated bundle in ${elapsedTimeFromNow(startedAt)} ms.`);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(resultingBundle);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

main();
