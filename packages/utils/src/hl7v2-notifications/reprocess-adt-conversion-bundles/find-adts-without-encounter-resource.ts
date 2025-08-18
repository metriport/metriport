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
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/find-adts-without-encounter-resource.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/find-adts-without-encounter-resource.ts
 *
 * Note: This script only reads data from S3 and logs findings. It does not modify any data.
 */

// You can use an empty string to run on all bundles
const prefixes: string[] = [];
const dryRun = true;

async function main() {
  await reprocessAdtConversionBundles(prefixes, findAdtsWithoutEncounterResource, dryRun);
}

/**
 * Handler function that identifies ADT bundles without encounter resources.
 *
 * @param bundle - The FHIR bundle to analyze
 * @param log - Logger function that includes the S3 file path being processed in its context.
 *              Use this to log messages that will be prefixed with the file being processed.
 *              Example: log("No encounters found") will output "[s3-file-path] No encounters found"
 * @param context - Contains customer ID (cxId) and patient ID (ptId) for the bundle
 * @returns The original bundle unchanged
 */
async function findAdtsWithoutEncounterResource(bundle: FhirBundleSdk): Promise<FhirBundleSdk> {
  const encounters = bundle.getEncounters();

  if (encounters.length === 0) {
    process.stdout.write(".");
    return bundle;
  }

  return bundle;
}

main();
