/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import _ from "lodash";
import { reprocessAdtConversionBundles } from "./common";

/**
 * Removes encounter reason codings from ADT conversion bundles stored in S3.
 *
 * This script pulls down every conversion bundle from s3, and removes any conditions that have identical codings to encounter reason codes.
 * It then uploads the cleaned bundles back to s3.
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (HL7_CONVERSION_BUCKET_NAME)
 * 2. Update the prefixes array on line 18 with the customer IDs to process
 * 3. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/remove-encounter-reason-codings.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/remove-encounter-reason-codings.ts
 *
 * Note: This script modifies data in S3. Ensure you have backups if needed.
 */

const prefixes: string[] = [];

async function main() {
  await reprocessAdtConversionBundles(prefixes, cleanDuplicateConditionIds, false);
}

async function cleanDuplicateConditionIds(
  bundle: FhirBundleSdk,
  log: (message: string) => void
): Promise<FhirBundleSdk> {
  const encounter = _(bundle.getEncounters()).first();
  if (encounter === undefined) {
    log("Encounter missing - critical, skipping");
    return bundle;
  }

  // Create old + new uuid pairings
  const conditionIds = _(bundle.getConditions())
    .map(c => {
      if (c.id === undefined) {
        log("Condition id missing - critical, skipping");
        return;
      }
      return {
        oldId: c.id,
        newId: createUuidFromText(`${encounter.id}-${JSON.stringify(c.code)}`),
      };
    })
    .compact()
    .value();

  // Replace all old ids with new ids
  const bundleAsString = JSON.stringify(bundle.toObject());
  const cleanedBundleString = conditionIds.reduce((acc, { oldId, newId }) => {
    return acc.replaceAll(oldId, newId);
  }, bundleAsString);

  return await FhirBundleSdk.create(JSON.parse(cleanedBundleString));
}

main();
