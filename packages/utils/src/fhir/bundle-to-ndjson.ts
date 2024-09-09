import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { bundleToNdjson } from "@metriport/core/external/fhir/export/fhir-to-ndjson";
import dayjs from "dayjs";
import fs from "fs";
import { ellapsedTimeAsStr } from "../shared/duration";
import { getFileContents, getFileNames, makeDir } from "../shared/fs";

/**
 * Script used to convert "_deduped.json" files (containing FHIR Bundles) into NDJSON files.
 * The resulf files are stored on the "runs/ndjson" folder.
 *
 * To use this script, set the samplesFolderPath to the folder containing the "_deduped.json" files.
 */
const samplesFolderPath = ``;

const suffixToInclude = "_deduped.json";
const stringToExclude = "";

async function main() {
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const bundleFileNames = getFileNames({
    folder: samplesFolderPath,
    recursive: true,
    extension: suffixToInclude,
  });
  const filteredBundleFileNames = bundleFileNames.filter(fileName =>
    stringToExclude ? !fileName.includes(stringToExclude) : true
  );
  console.log(`Got ${filteredBundleFileNames.length} files to process.`);

  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/ndjson/${timestamp}`;
  makeDir(logsFolderName);

  filteredBundleFileNames.forEach((filePath, index) => {
    console.log(`Processing ${index + 1}/${bundleFileNames.length}. Filepath: ${filePath}`);

    const stringBundle = getFileContents(filePath);
    const bundle: Bundle = JSON.parse(stringBundle);

    const lastSlash = filePath.lastIndexOf("/");
    const fileName = filePath.slice(lastSlash + 1).replace(".json", ".ndjson");

    const bundleAsNdjson = bundleToNdjson(bundle);
    fs.writeFileSync(`./${logsFolderName}/${fileName}`, bundleAsNdjson);
  });

  console.log(`>>> Done in ${ellapsedTimeAsStr(startedAt)}`);
}

main();
