import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getFileContentsAsync, getFileNames } from "../shared/fs";

dayjs.extend(duration);

/**
 * Script to validate FHIR bundles.
 *
 * It will:
 * - read all JSON files in the folder;
 * - validate that each resource has a request with a method;
 *
 * Set:
 * - folderName: the folder with the JSON FHIR bundles;
 */

const folderName = ``;

export async function main() {
  await sleep(100);
  const startedAt = Date.now();

  console.log(`Running  - started at ${new Date().toISOString()}`);

  // Get XML files
  const jsonFiles = getFileNames({
    folder: folderName,
    recursive: true,
    extension: ".json",
  });
  console.log(`Found ${jsonFiles.length} JSON files.`);

  console.log(`Reading ${jsonFiles.length} files...`);
  await Promise.allSettled(
    jsonFiles.map(async fileName => {
      const resources = await getResources(fileName);
      for (const resource of resources) {
        const log = (msg: string) =>
          console.log(
            `>>> ${msg} in resource ${resource.id} on ${fileName}\n...${JSON.stringify(resource)}}`
          );
        if (!resource.request) {
          log(`Missing request`);
          return;
        }
        if (!resource.request.method) {
          log(`Missing request verb`);
          return;
        }
      }
      return { fileName, resources };
    })
  );

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);

  return;
}

async function getResources(fileName: string): Promise<BundleEntry<Resource>[]> {
  const contents = await getFileContentsAsync(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  return bundle.entry ?? [];
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
