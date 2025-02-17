import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  buildConsolidatedBundle,
  merge,
} from "@metriport/core/command/consolidated/consolidated-create";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { sleep } from "@metriport/shared";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { initPatientIdRepository } from "../bulk-insert-patients";
import { getFileNames } from "../shared/fs";
import { parseFhirBundle } from "@metriport/shared/medical";

dayjs.extend(duration);

/**
 * Creates a consolidated bundle from a collection of converted JSONs locally. Requires a folder with FHIR JSON files.
 */

const bundlesLocation = ``;

let startedAt = Date.now();
const outputFolderName = `${bundlesLocation}/consolidated`;

const program = new Command();
program
  .name("consolidate-create")
  .description("Creates a Consolidated Bundle from local conversions")
  .parse()
  .showHelpAfterError();

export async function main() {
  initPatientIdRepository(outputFolderName);
  await sleep(100);
  startedAt = Date.now();

  console.log(`Creating consolidated bundle - started at ${new Date().toISOString()}`);

  const jsonFileNames = getFileNames({
    folder: bundlesLocation,
    recursive: true,
    extension: "json",
  });
  console.log(`Found ${jsonFileNames.length} JSON files.`);

  const mergedBundle = buildConsolidatedBundle();
  await executeAsynchronously(
    jsonFileNames,
    async filePath => {
      const contents = getFileContents(filePath);
      const singleConversion = parseFhirBundle(contents);
      if (!singleConversion) {
        console.log(`No valid bundle found in ${filePath}, skipping`);
        return;
      }
      merge(singleConversion).into(mergedBundle);
    },
    { numberOfParallelExecutions: 10 }
  );

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);

  console.log(`File Location: ${outputFolderName}`);
  fs.writeFileSync(`${outputFolderName}/consolidated.json`, JSON.stringify(mergedBundle, null, 2));
  return;
}

main().then(() => {
  process.exit(0);
});
