import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, BundleEntry } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import { sortBy } from "lodash";
import { elapsedTimeAsStr } from "../shared/duration";
import { getFileContents, writeFileContents } from "../shared/fs";

const fileNames: string[] = [];

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  for (const fileName of fileNames) {
    // open the file and convert it to Bundle
    const contents = getFileContents(fileName);
    const bundle: Bundle = JSON.parse(contents);

    const sortedResources = sortBy(bundle.entry, sortFn);
    bundle.entry = sortedResources;
    bundle.total = sortedResources.length;
    writeFileContents(fileName + "_sorted.json", JSON.stringify(bundle, null, 2));
  }

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function sortFn(entry: BundleEntry): string {
  const r = entry.resource;
  return r ? `${r.resourceType}/${r.id}` : "empty";
}

main();
