import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { BundleEntry, Patient } from "@medplum/fhirtypes";
import {
  buildConsolidatedBundle,
  merge,
} from "@metriport/core/command/consolidated/consolidated-create";
import { deduplicate } from "@metriport/core/external/fhir/consolidated/deduplicate";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { controlDuration } from "@metriport/core/util/race-control";
import { getFileContents } from "@metriport/core/util/fs";
import { sleep } from "@metriport/shared";
import { parseFhirBundle } from "@metriport/shared/medical";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { initPatientIdRepository } from "../bulk-insert-patients";
import { getFileNames } from "../shared/fs";
import { generateAiBriefBundleEntry } from "@metriport/core/domain/ai-brief/generate";
import { out } from "@metriport/core/util";

dayjs.extend(duration);

const AI_BRIEF_TIMEOUT = dayjs.duration(1.5, "minutes");
const TIMED_OUT = Symbol("TIMED_OUT");

/**
 * Creates a consolidated bundle from a collection of converted JSONs locally. Requires a folder with FHIR JSON files.
 */

const bundlesFolder = `/Users/ramilgaripov/Desktop/metriport/full_stack/metriport/packages/utils/runs/fhir-converter-integration/FOR_TESTS_ONLY_CONVERTED/output/batch1_large/018a82ac-6c5a-7095-8c5a-0e38cae57db1`;
const outputFolder = `${bundlesFolder}/consolidated`;

const createAiBrief = true;
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
  const { log } = out(`Consolidated Create - LOCAL`);
  const startedAt = Date.now();
  initPatientIdRepository(outputFolderName);
  await sleep(100);

  log(`Started at ${new Date().toISOString()}`);

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

  if (createAiBrief && deduped.entry && deduped.entry.length > 0) {
    const binaryBundleEntry = await Promise.race([
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      generateAiBriefBundleEntry(deduped, cxId, patient.id!, log),
      controlDuration(AI_BRIEF_TIMEOUT.asMilliseconds(), TIMED_OUT),
    ]);

    if (binaryBundleEntry === TIMED_OUT) {
      log(`AI Brief generation timed out after ${AI_BRIEF_TIMEOUT.asMinutes()} minutes`);
    } else if (binaryBundleEntry) {
      deduped.entry?.push(binaryBundleEntry);
    }
  }

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);
  console.log(`File Location: ${outputFolderName}`);

  fs.writeFileSync(
    `${outputFolderName}/consolidated_with_dups.json`,
    JSON.stringify(withDups, null, 2)
  );
  fs.writeFileSync(`${outputFolderName}/consolidated.json`, JSON.stringify(deduped, null, 2));
  return;
}

createConsolidatedFromLocal(bundlesFolder, outputFolder).then(() => {
  process.exit(0);
});
