import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { buildSlimmerPayload } from "@metriport/core/command/ai-brief/filter";
import { SlimResource } from "@metriport/core/domain/ai-brief/modify-resources";
import { buildCollectionBundle } from "@metriport/core/external/fhir/bundle/bundle";
import { getFileContents, makeDirIfNeeded } from "@metriport/core/util/fs";
import { sleep } from "@metriport/core/util/sleep";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { elapsedTimeAsStr } from "../../shared/duration";
import { buildGetDirPathInside, initRunsFolder } from "../../shared/folder";

dayjs.extend(duration);

/**
 * Script compare the output of the buildSlimmerPayload funcion with the original bundle.
 */

const bundleFilePath = "";

const outputRootFolderName = `fhir-to-slim`;
initRunsFolder(outputRootFolderName);
const getFolderName = buildGetDirPathInside(outputRootFolderName);
const outputDirPath = getFolderName() + "/";
makeDirIfNeeded(outputDirPath);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();

  console.log(`Generating a slimmer bundle from ${bundleFilePath}...`);

  const bundleContents = getFileContents(bundleFilePath);
  const bundle = JSON.parse(bundleContents);
  const slimPayloadBundle = buildSlimmerPayload(bundle);
  if (!slimPayloadBundle) {
    console.log(`Slimmer payload is empty, skipping...`);
    return;
  }

  const entries = slimPayloadBundle.map(buildSlimBundleEntry);
  const slimBundle = buildCollectionBundle(entries);
  const slimPayloadBundleAsString = JSON.stringify(slimBundle, null, 2);

  fs.writeFileSync(outputDirPath + "original.json", JSON.stringify(bundle, null, 2));
  fs.writeFileSync(outputDirPath + "slim.json", slimPayloadBundleAsString);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function buildSlimBundleEntry(resource: SlimResource): BundleEntry {
  return { resource: resource as unknown as Resource };
}

if (require.main === module) {
  main();
}
