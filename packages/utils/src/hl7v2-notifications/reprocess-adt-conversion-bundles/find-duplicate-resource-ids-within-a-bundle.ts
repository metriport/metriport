/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import _ from "lodash";
import { reprocessAdtConversionBundles } from "./common";

/**
 * Finds duplicate resource IDs within ADT conversion bundles stored in S3.
 *
 * This script pulls down every conversion bundle from S3 and checks for duplicate resource IDs within each bundle.
 * It logs when duplicates are found but does not modify the bundles.
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (HL7_CONVERSION_BUCKET_NAME)
 * 2. Update the prefixes array on line 29 with the customer IDs to process
 * 3. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/find-duplicate-resource-ids-within-a-bundle.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/find-duplicate-resource-ids-within-a-bundle.ts
 *
 * Note: This script only reads data from S3 and logs findings. It does not modify any data.
 */

// You can use an empty string to run on all bundles
const prefixes: string[] = [];

async function main() {
  await reprocessAdtConversionBundles(prefixes, cleanDuplicateConditionIds, true);
}

async function cleanDuplicateConditionIds(
  bundle: FhirBundleSdk,
  log: (message: string) => void
): Promise<FhirBundleSdk> {
  const observationIds = _(bundle.getConditions())
    .map(e => e.id)
    .compact()
    .value();

  const observationDuplicates = _.uniq(observationIds).length !== observationIds.length;

  if (observationDuplicates) {
    log("Condition duplicates found");
  }

  const encounterIds = _(bundle.getEncounters())
    .map(e => e.id)
    .compact()
    .value();

  const encounterDuplicates = _.uniq(encounterIds).length !== encounterIds.length;

  if (encounterDuplicates) {
    log("Encounter duplicates found");
  }

  return bundle;
}

main();
