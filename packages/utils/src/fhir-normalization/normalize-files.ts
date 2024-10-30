import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { normalizeFhir } from "@metriport/core/fhir-normalization/normalize-fhir";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getFileContents, getFileNames, makeDir } from "../shared/fs";

/**
 * Folder with consolidated files/bundles.
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

  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/normalization/${timestamp}`;

  makeDir(logsFolderName);

  await executeAsynchronously(filteredBundleFileNames, async (filePath, index) => {
    console.log(`Processing ${index + 1}/${filteredBundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const initialBundle: Bundle = JSON.parse(stringBundle);

    const startedAt = new Date();

    const cxId = uuidv4();
    const patientId = uuidv4();
    const resultingBundle = normalizeFhir(initialBundle, cxId, patientId);

    console.log(`normalized bundle in ${elapsedTimeFromNow(startedAt)} ms.`);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).split(".json")[0];
    const fileNameWithExtension = `${fileName}${suffix}.json`;

    const output = JSON.stringify(resultingBundle);
    fs.writeFileSync(`./${logsFolderName}/${fileNameWithExtension}`, output);
    fs.writeFileSync(`${samplesFolderPath}/${fileNameWithExtension}`, output);
  });
}

main();
