import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { hydrateFhir } from "@metriport/core/fhir-hydration/hydrate-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getFileContents, getFileNames, makeDir } from "../shared/fs";

/**
 * Folder with consolidated files/bundles.
 *
 * WARNING: this will overwrite the *_hydrated.json files!!!
 */
const samplesFolderPath =
  "/Users/ramilgaripov/Documents/phi/0191a376-7055-7e58-96e6-d6a9e43e328f/hydration";

const suffix = "_hydrated";

async function main() {
  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: "json",
  });
  const filteredBundleFileNames = bundleFileNames.filter(f => !f.includes(suffix));

  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/hydration/${timestamp}`;

  makeDir(logsFolderName);

  await executeAsynchronously(filteredBundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${filteredBundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const initialBundle: Bundle = JSON.parse(stringBundle);

    const startedAt = new Date();

    const cxId = uuidv4();
    const patientId = uuidv4();
    const resultingBundle = hydrateFhir(initialBundle, cxId, patientId);

    console.log(`Hydrated bundle in ${elapsedTimeFromNow(startedAt)} ms.`);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(resultingBundle);
    fs.writeFileSync(`./${logsFolderName}/${fileNameWithExtension}`, output);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

main();
