import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { addMissingReferences } from "@metriport/core/command/consolidated/consolidated-filter";
import { getFileContents, makeDirIfNeeded } from "@metriport/core/util/fs";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { cloneDeep } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * Script to test filtering out resources from a consolidated bundle and later on
 * adding the missing, dangling references.
 *
 * Stores all bundles:
 * - original.json: the original bundle
 * - filtered.json: the filtered bundle, with dangling references
 * - hydrated.json: the hydrated bundle, with all references added
 *
 * Usage:
 * - set the full path to the consolidated bundle file
 * - run the script
 */

const bundleFilePath = ``;

const outputFolderName = `consolidated-add-missing-refs`;
initRunsFolder(outputFolderName);
const getFolderName = buildGetDirPathInside(outputFolderName);
const outputDirPath = getFolderName() + "/";
makeDirIfNeeded(outputDirPath);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  console.log(`Filtering reosurces from bundle ${bundleFilePath}...`);

  const bundleContents = getFileContents(bundleFilePath);
  const bundle = JSON.parse(bundleContents) as Bundle<Resource>;

  const filteredBundle = cloneDeep(bundle);
  filteredBundle.entry = filteredBundle.entry?.filter(
    entry => entry.resource?.resourceType !== "Practitioner"
  );

  const hydrated = addMissingReferences(filteredBundle, bundle);

  const originalBundleAsString = JSON.stringify(bundle, null, 2);
  const filteredBundleAsString = JSON.stringify(filteredBundle, null, 2);
  const hydratedBundleAsString = JSON.stringify(hydrated, null, 2);

  fs.writeFileSync(outputDirPath + "original.json", originalBundleAsString);
  fs.writeFileSync(outputDirPath + "filtered.json", filteredBundleAsString);
  fs.writeFileSync(outputDirPath + "hydrated.json", hydratedBundleAsString);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
