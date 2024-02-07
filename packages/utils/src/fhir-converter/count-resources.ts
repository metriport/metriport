import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { isDirectory } from "../shared/fs";
import { countResourcesPerDirectory, getResourceCountByFile } from "./shared";

/**
 * Outputs the number of resources in a FHIR bundle. Expects one
 * argument which is the path to the a JSON file containing a
 * FHIR bundle or a directory containing such files (will search
 * recursively).
 *
 * Usage:
 * > ts-node src/fhir-converter/count-resources.ts <file/folder.json>
 */

export async function main() {
  const fileName = process.argv[2];

  if (!fileName) {
    console.log(`Usage: ts-node src/fhir-converter/count-resources.ts <file/folder.json>`);
    process.exit(1);
  }

  if (isDirectory(fileName)) {
    const consolidated = await countResourcesPerDirectory(fileName);
    console.log(`Resources: ${JSON.stringify(consolidated.countPerType, null, 2)}`);
    console.log(`Total: ${consolidated.total}`);
    return;
  }

  const { total, countPerType } = await getResourceCountByFile(fileName);
  console.log(`Resources: ${JSON.stringify(countPerType, null, 2)}`);
  console.log(`Total: ${total}`);

  return;
}

main();
