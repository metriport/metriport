import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { getReferencesFromResources } from "@metriport/core/external/fhir/bundle/bundle";
import { getFileContents, makeDirIfNeeded } from "@metriport/core/util/fs";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../shared/folder";

dayjs.extend(duration);

/**
 * Extracts the references from a consolidated bundle and saves them to a file.
 * Also saves the missing references to a file.
 * Files are stored in the runs/consolidated-refs-from/ folder.
 *
 * Usage:
 * - set the full path to the consolidated bundle file
 * - run the script
 */

const bundleFilePath = ``;

const outputFolderName = `consolidated-refs-from`;
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

  const entries = bundle.entry ?? [];
  const resourcesToCheckRefs = entries.flatMap(e => e.resource ?? []);
  const { references, missingReferences } = getReferencesFromResources({ resourcesToCheckRefs });

  const refsAsString = JSON.stringify(references, null, 2);
  const missingRefsAsString = JSON.stringify(missingReferences, null, 2);

  fs.writeFileSync(outputDirPath + "refs.json", refsAsString);
  fs.writeFileSync(outputDirPath + "missing-refs.json", missingRefsAsString);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}
