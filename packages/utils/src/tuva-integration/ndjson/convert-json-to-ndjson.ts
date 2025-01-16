import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import fs from "fs";

const filePath =
  "/Users/ramilgaripov/Documents/phi/z_chris_smith/10cce4ac-3628-4f79-bda1-61c73da58759_0192da90-6f7d-71bd-b40c-7ea4bafc2a43_CONSOLIDATED_DATA.json";

async function main() {
  const rawContents = fs.readFileSync(filePath, "utf-8");
  const bundle = JSON.parse(rawContents) as Bundle<Resource>;
  if (bundle.entry) {
    const ndjsonResources = jsonToNdjson(bundle.entry);
    fs.writeFileSync("output.ndjson", ndjsonResources);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonToNdjson(jsonArray: any[]) {
  return jsonArray.map(obj => JSON.stringify(obj.resource)).join("\n");
}

main();
