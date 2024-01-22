import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { getFileContents } from "../shared/fs";
import { countResourcesPerType } from "./shared";

/**
 * Outputs the number of resources in a FHIR bundle. Expects one
 * argument which is the path to the a JSON file containing a
 * FHIR bundle.
 *
 * Usage:
 * > ts-node src/fhir-converter/count-resources.ts <file.json>
 */

export async function main() {
  const fileName = process.argv[2];
  if (!fileName) {
    console.log(`Usage: ts-node src/fhir-converter/count-resources.ts <file.json>`);
    process.exit(1);
  }

  const contents = getFileContents(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }

  const countPerType = countResourcesPerType(bundle);
  console.log(`Resources: ${JSON.stringify(countPerType, null, 2)}`);

  const resources = bundle.entry?.flatMap(entry => entry.resource ?? []);
  console.log(`Total: ${resources.length}`);

  return;
}

main();
