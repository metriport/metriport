/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { mergeAdtBundles } from "@metriport/core/external/fhir/adt-encounters";
import { buildBundle } from "@metriport/core/external/fhir/bundle/bundle";
import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { reprocessAdtConversionBundles } from "./common";

/**
 * Deduplicates resources within existing ADT conversion bundles stored in S3.
 *
 * This script pulls down every conversion bundle from S3, deduplicates the resources within each bundle
 * using the mergeAdtBundles function (by merging with an empty bundle), and uploads the cleaned bundles back to S3.
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (HL7_CONVERSION_BUCKET_NAME)
 * 2. Update the prefixes array on line 29 with the customer IDs to process
 * 3. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/deduplicate-existing-bundles.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/deduplicate-existing-bundles.ts
 *
 * Note: This script modifies data in S3. Ensure you have backups if needed.
 */

const prefixes: string[] = [];
const dryRun = true;

async function main() {
  await reprocessAdtConversionBundles(prefixes, deduplicateExistingBundles, dryRun);
}

async function deduplicateExistingBundles(
  bundle: FhirBundleSdk,
  log: (message: string) => void,
  context: { cxId: string; ptId: string }
): Promise<FhirBundleSdk | undefined> {
  const { cxId, ptId } = context;

  const emptyBundle = buildBundle({
    type: "collection",
    entries: [],
  });

  try {
    const resultBundle = mergeAdtBundles({
      cxId,
      patientId: ptId,
      existing: bundle.toObject(),
      current: emptyBundle,
    });

    return await FhirBundleSdk.create(resultBundle);
  } catch (error) {
    log(`Error merging bundles - did validation fail?`);
    return undefined;
  }
}

main();
