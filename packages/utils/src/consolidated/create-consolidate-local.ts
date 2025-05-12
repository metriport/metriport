import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, BundleEntry, Patient } from "@medplum/fhirtypes";
import {
  buildConsolidatedBundle,
  merge,
} from "@metriport/core/command/consolidated/consolidated-create";
import { deduplicate } from "@metriport/core/external/fhir/consolidated/deduplicate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getFileContents } from "@metriport/core/util/fs";
import { sleep } from "@metriport/shared";
import { parseFhirBundle } from "@metriport/shared/medical";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { initPatientIdRepository } from "../bulk-insert-patients";
import { getFileNames } from "../shared/fs";

dayjs.extend(duration);

/**
 * Creates a consolidated bundle from a collection of converted JSONs locally. Requires a folder with FHIR JSON files.
 */

const bundlesFolder = ``;
const outputFolder = `${bundlesFolder}/consolidated`;

// Not necessary - just used for logging / analytics on dedup
const cxId = ``;

const program = new Command();
program
  .name("consolidate-create")
  .description("Creates a Consolidated Bundle from local conversions")
  .parse()
  .showHelpAfterError();

// Need a patient resource for deduplication.
const patient: BundleEntry<Patient> = {
  fullUrl: "<uuid>",
  resource: {
    resourceType: "Patient",
    id: "<uuid>",
  },
};

export async function createConsolidatedFromLocal(
  bundlesLocation: string,
  outputFolderName: string
) {
  const startedAt = Date.now();
  initPatientIdRepository(outputFolderName);
  await sleep(100);

  console.log(`Creating consolidated bundle - started at ${new Date().toISOString()}`);

  const jsonFileNames = getFileNames({
    folder: bundlesLocation,
    recursive: true,
    extension: "json",
  });
  console.log(`Found ${jsonFileNames.length} JSON files.`);

  const withDups = buildConsolidatedBundle();
  await executeAsynchronously(
    jsonFileNames,
    async filePath => {
      const contents = getFileContents(filePath);
      const singleConversion = parseFhirBundle(contents);
      if (!singleConversion) {
        console.log(`No valid bundle found in ${filePath}, skipping`);
        return;
      }
      merge(singleConversion).into(withDups);
    },
    { numberOfParallelExecutions: 10 }
  );

  withDups.entry?.push(patient);
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const deduped = await deduplicate({ cxId, patientId: patient.id!, bundle: withDups });
  const normalized = await normalize({ cxId, patientId: patient.id!, bundle: deduped });

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);
  console.log(`File Location: ${outputFolderName}`);

  fs.writeFileSync(
    `${outputFolderName}/consolidated_with_dups.json`,
    JSON.stringify(withDups, null, 2)
  );
  fs.writeFileSync(`${outputFolderName}/consolidated.json`, JSON.stringify(normalized, null, 2));

  console.log("countResources before", countResources(withDups));
  console.log("countResources after", countResources(normalized));
  return;
}

createConsolidatedFromLocal(bundlesFolder, outputFolder).then(() => {
  process.exit(0);
});

function countResources(bundle: Bundle): Record<string, number> {
  const counts: Record<string, number> = {};
  bundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const resourceType: string = entry.resource.resourceType;
    counts[resourceType] = (counts[resourceType] || 0) + 1;
  });
  return counts;
}
