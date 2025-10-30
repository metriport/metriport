/* eslint-disable no-useless-escape */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { displayWarningAndConfirmation, reprocessAdtConversionBundles } from "./common";
import { createExtensionDataSource } from "@metriport/core/external/fhir/shared/extensions/extension";
import { ResourceWithExtension } from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index";
import { readFileSync } from "fs";
import { sleep } from "@metriport/shared/common/sleep";
import { Bundle, Extension, Resource } from "@medplum/fhirtypes";

/**
 *
 * This script pulls down every conversion bundle from S3, and adds the datasource to each resource.
 *
 * Steps:
 * 1. Ensure your .env file has the required AWS and bucket configuration (HL7_CONVERSION_BUCKET_NAME)
 * 2. Ensure you have a csv containing exactly "cx_id","patient_id","hies"
 * 3. Add the local path to that csv
 * 4. Run the script:
 *    npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/backfill-datasource-extension.ts
 *
 * Usage:
 * Run with: npx ts-node src/hl7v2-notifications/reprocess-adt-conversion-bundles/backfill-datasource-extension.ts
 *
 * Note: This script modifies data in S3. Ensure you have backups if needed.
 */

const dryRun = true;
const inputFile = "";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node
  const rows = csvParseAll(inputFile);
  console.log(`Found ${rows.length} patients.`);
  if (!dryRun) {
    console.log("This is about to show a small sample of the files to be updated!");
    const min = Math.min(10, rows.length);
    const sample = rows.slice(0, min).map(r => getPrefix(r.cxId, r.ptId));
    await displayWarningAndConfirmation(sample);
  } else {
    console.log("Proceeding to run in dry run mode.");
  }

  for (const row of rows) {
    const hieNames = row.hieNames;
    const prefix = getPrefix(row.cxId, row.ptId);
    const handler = createHandler(hieNames);
    await reprocessAdtConversionBundles([prefix], handler, dryRun, true);
  }
}

function createHandler(hieNames: string[]) {
  return async function handler(bundle: FhirBundleSdk): Promise<FhirBundleSdk | undefined> {
    return addSourceExtensionToEachResource(bundle, hieNames);
  };
}
async function addSourceExtensionToEachResource(
  bundle: FhirBundleSdk,
  hieNames: string[]
): Promise<FhirBundleSdk | undefined> {
  const diffBundle = bundle.toObject();
  let updatedBundle = diffBundle;
  for (const hieName of hieNames) {
    updatedBundle = appendExtensionToEachResource(
      updatedBundle,
      createExtensionDataSource(hieName.toUpperCase())
    );
  }
  return FhirBundleSdk.create(updatedBundle);
}

function getPrefix(cxId: string, ptId: string): string {
  return `cxId=${cxId}/ptId=${ptId}`;
}

type Row = { cxId: string; ptId: string; hieNames: string[] };

function csvParseAll(path: string): Row[] {
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  return lines.slice(1).map(line => {
    const [cxId, ptId, hieCell] = splitCSVLine(line);
    return { cxId, ptId, hieNames: hieCell.split(",").map(s => s.trim()) };
  });
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Any changes made to this function make sure to change the one in index.
 * @metriport/core/src/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/index.ts
 *
 * Note the only difference is the if(hasExtension) change
 */
function appendExtensionToEachResource(
  bundle: Bundle<Resource>,
  newExtension: Extension
): Bundle<Resource> {
  if (!bundle.entry) {
    throw new Error("No entry in bundle");
  }
  return {
    ...bundle,
    entry: bundle.entry.map(e => {
      const resource = e.resource;
      if (!resource) return e;

      const existing: Extension[] = (resource as ResourceWithExtension).extension ?? [];

      if (hasExtension(existing, newExtension)) {
        return e;
      }

      const extension = [...existing, newExtension];

      return {
        ...e,
        resource: {
          ...resource,
          extension: extension,
        } as Resource,
      };
    }),
  };
}

function hasExtension(list: Extension[], target: Extension): boolean {
  for (let i = 0; i < list.length; i++) {
    if (extensionsEqual(list[i], target)) return true;
  }
  return false;
}

function extensionsEqual(a: Extension | undefined, b: Extension | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.url !== b.url) return false;
  return jsonEqual(extensionValue(a), extensionValue(b));
}

function extensionValue(extension: Extension): unknown {
  const record = extension as unknown as Record<string, unknown>;
  for (const value in record) {
    if (value.startsWith("value") && value !== "valueElement") return record[value];
  }
  return undefined;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

main();
