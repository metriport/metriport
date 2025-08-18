/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { reprocessAdtConversionBundles } from "./common";

/**
 * Finds ADT conversion bundles that don't contain any encounter resources.
 *
 * This script pulls down every conversion bundle from S3 and checks if the bundle contains encounter resources.
 * It prints a dot (.) for each bundle that doesn't have any encounters but does not modify the bundles.
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
const dryRun = true;

async function main() {
  await reprocessAdtConversionBundles(prefixes, findAdtsWithoutEncounterResource, dryRun);
}

async function findAdtsWithoutEncounterResource(
  bundle: FhirBundleSdk
  // log: (message: string) => void
): Promise<FhirBundleSdk> {
  const encounters = bundle.getEncounters();

  if (encounters.length === 0) {
    process.stdout.write(".");
    return bundle;
  }

  return bundle;
}

main();
