import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import fs from "fs";

/**
 * Converts JSON to NDJSON.
 *
 * Use this on a Metriport's FHIR Payload, aka Consolidated Bundle.
 */

const filePath = "";

async function main() {
  const rawContents = fs.readFileSync(filePath, "utf-8");
  const bundle = JSON.parse(rawContents) as Bundle<Resource>;
  if (bundle.entry) {
    const ndjsonResources = jsonToNdjson(bundle.entry);
    fs.writeFileSync(`${filePath}/output.ndjson`, ndjsonResources);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToNdjson(jsonArray: any[]) {
  return jsonArray.map(obj => JSON.stringify(obj.resource)).join("\n");
}

main();
