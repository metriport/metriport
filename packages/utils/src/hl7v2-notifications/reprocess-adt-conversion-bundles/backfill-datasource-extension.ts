/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { reprocessAdtConversionBundles } from "./common";
import { createExtensionDataSource } from "@metriport/core/external/fhir/shared/extensions/extension";

/**
 *
 * This script pulls down every conversion bundle from S3, and adds the datasource to each resource.
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (HL7_CONVERSION_BUCKET_NAME)
 * 2. Update the prefixes array on line 26 with the customer IDs to process
 * 3. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/backfill-datasource-extension.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/backfill-datasource-extension.ts
 *
 * Note: This script modifies data in S3. Ensure you have backups if needed.
 */

const prefixes: string[] = [];
const dryRun = true;
const hieName = "";

async function main() {
  console.log(`Adding datasource ${hieName} to resources. Make sure this is correct.`);
  await reprocessAdtConversionBundles(prefixes, deduplicateExistingBundles, dryRun);
}

async function deduplicateExistingBundles(
  bundle: FhirBundleSdk
): Promise<FhirBundleSdk | undefined> {
  for (const entry of bundle.entry) {
    const dataSourceExtension = createExtensionDataSource(hieName.toUpperCase());
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resource = entry.resource as any;
    resource.extension = [...(resource.extension ?? []), dataSourceExtension];
    return bundle;
  }
}

main();
