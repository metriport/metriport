import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, Resource } from "@medplum/fhirtypes";
import { out } from "@metriport/core/util/log";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { initRunsFolder } from "../shared/folder";
import { getMissingReferences } from "./report/validate-references";

/**
 * Utility to validate references on a FHIR bundle.
 *
 * Usage:
 * - set the path to the file on `filePath`
 * - run `ts-node src/fhir-deduplication/validate-references.ts`
 */
const filePath = "";

async function main() {
  const startedAt = Date.now();
  initRunsFolder();
  const { log } = out(``);

  const bundleFile = fs.readFileSync(filePath, "utf8");

  const resources: Resource[] =
    JSON.parse(bundleFile).entry?.map((entry: BundleEntry) => entry.resource) ?? [];

  log(`Validating references on bundle (${resources.length} resources)...`);
  const res = getMissingReferences(resources);

  const resourcesWithMissingRefs = res.filter(r => r.missingRefs.length > 0);

  if (resourcesWithMissingRefs.length) {
    console.log(`Found ${resourcesWithMissingRefs.length} resources with missing references:`);
    resourcesWithMissingRefs.forEach(r => {
      const resource = r.resource;
      console.log(`- resource: ${resource.resourceType}/${resource.id} - missing refs:`);
      r.missingRefs.forEach(missingRef => {
        console.log(`   - ${missingRef}`);
      });
    });
  } else {
    console.log(`No resources with missing references, yay!`);
  }

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
