import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";
import { getReferencesFromResources } from "@metriport/core/external/fhir/shared/bundle";
import { sleep } from "@metriport/shared";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniqBy } from "lodash";
import { getFileContentsAsync, getFileNames } from "../shared/fs";

dayjs.extend(duration);

/**
 * Script to count the number of resources and references, including missing ones, in FHIR bundles.
 */

const folderName: string = ``; // eslint-disable-line @typescript-eslint/no-inferrable-types

// keep empty to include all references
const referencesToInclude: ResourceType[] = [];
// const referencesToInclude: ResourceType[] = [
//   "Location",
//   "Organization",
//   "RelatedPerson",
//   "Device",
//   "Practitioner",
//   "Medication",
// ];

let totalResources = 0;
let totalReferences = 0;
let totalMissingReferences = 0;

async function main() {
  await sleep(100);
  const startedAt = Date.now();

  if (!folderName || folderName.trim().length <= 0) {
    console.log(`Missing folder name`);
    process.exit(1);
  }

  console.log(`Running  - started at ${new Date().toISOString()}`);

  const jsonFiles = getFileNames({
    folder: folderName,
    recursive: true,
    extension: ".json",
  });
  const filteredFileNames = jsonFiles.filter(f => !f.includes("error"));
  console.log(`Found ${filteredFileNames.length} JSON files.`);

  console.log(`Reading ${filteredFileNames.length} files...`);
  for (const fileName of filteredFileNames) {
    await executeForFile(fileName);
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`\nTotal files: ${filteredFileNames.length}`);
  console.log(`Total resources: ${totalResources}`);
  console.log(`Total references: ${totalReferences}`);
  console.log(`Total missing references: ${totalMissingReferences}`);
  console.log(`Duration: ${duration} ms / ${formatNumber(durationMin)} min`);

  return;
}

async function executeForFile(fileName: string) {
  console.log(`File ${fileName}`);
  const { resources } = await getResources(fileName);
  for (const resource of resources) {
    const resId = resource.id;
    if (!resId) {
      console.log(`... Missing id in resource ${JSON.stringify(resource)}`);
      return;
    }
  }

  const { references, missingReferences } = getReferencesFromResources({
    resources,
    referencesToInclude,
  });

  totalResources += resources.length;
  totalReferences += references.length;
  totalMissingReferences += missingReferences.length;

  console.log(
    `... ${resources.length} resources, ${references.length} refs, ${missingReferences.length} missing refs`
  );
  const missingRefTypes = uniqBy(missingReferences, r => r.type).map(r => r.type);
  console.log(
    `... ... Missing refs: ${missingRefTypes.length ? missingRefTypes.join(", ") : "none"}`
  );
}

async function getResources(fileName: string): Promise<{ resources: Resource[]; raw: string }> {
  const contents = await getFileContentsAsync(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  const entries = bundle.entry ?? [];
  return { resources: entries.flatMap(e => e.resource ?? []) ?? [], raw: contents };
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
