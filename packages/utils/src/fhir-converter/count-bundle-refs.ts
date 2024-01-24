import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniq } from "lodash";
import { getFileContentsAsync, getFileNames } from "../shared/fs";

dayjs.extend(duration);

/**
 * Script to count the number of resources and references, including missing ones, in FHIR bundles.
 */

const folderName = ``;

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

const referenceRegex = new RegExp(/"reference":\s*"(.+?)"/g);

let totalResources = 0;
let totalReferences = 0;
let totalMissingReferences = 0;

export async function main() {
  await sleep(100);
  const startedAt = Date.now();

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
  const { resources, raw } = await getResources(fileName);
  for (const resource of resources) {
    const resId = resource.id;
    if (!resId) {
      console.log(`... Missing id in resource ${JSON.stringify(resource)}`);
      return;
    }
  }
  const resourceIds = resources.flatMap(r => r.id ?? []);
  const references = getReferencesFromRaw(raw);
  const refIds = references.map(r => r.id);
  const missingRefs: string[] = [];
  for (const ref of references) {
    if (!resourceIds.includes(ref.id)) {
      missingRefs.push(ref.resourceType);
    }
  }
  const uniqueRefs = uniq(missingRefs);

  totalResources += resources.length;
  totalReferences += refIds.length;
  totalMissingReferences += missingRefs.length;

  console.log(
    `... ${resources.length} resources, ${refIds.length} refs, ${missingRefs.length} missing refs`
  );
  console.log(`... ... Missing refs: ${uniqueRefs.length ? uniqueRefs.join(", ") : "none"}`);
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

function getReferencesFromRaw(rawContents: string) {
  const matches = rawContents.matchAll(referenceRegex);
  const references = [];
  for (const match of matches) {
    const ref = match[1];
    if (ref) references.push(ref);
  }
  const uniqueRefs = uniq(references);
  const preResult = uniqueRefs.map(r => {
    const parts = r.split("/");
    return { resourceType: parts[0], id: parts[1], reference: r };
  });
  if (referencesToInclude.length === 0) return preResult;
  return preResult.filter(r => referencesToInclude.includes(r.resourceType as ResourceType));
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
