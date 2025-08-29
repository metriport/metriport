/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { reprocessAdtConversionBundles } from "./common";
import { createExtensionDataSource } from "@metriport/core/external/fhir/shared/extensions/extension";
import { appendExtensionToEachResource } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index";

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

const prefixes: string[] = ["cxId=testing/ptId=testing/"];
const dryRun = false;
const hieName = "MyTestHIE";

async function main() {
  console.log(`Adding datasource ${hieName} to resources. Make sure this is correct.`);
  await reprocessAdtConversionBundles(prefixes, addSourceExtensionToEachResource, dryRun);
}

async function addSourceExtensionToEachResource(
  bundle: FhirBundleSdk
): Promise<FhirBundleSdk | undefined> {
  const diffBundle = bundle.toObject();
  const updated = appendExtensionToEachResource(
    diffBundle,
    createExtensionDataSource(hieName.toUpperCase())
  );
  return FhirBundleSdk.create(updated);
}

main();
