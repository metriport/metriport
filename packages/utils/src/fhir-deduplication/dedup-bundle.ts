import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle } from "@medplum/fhirtypes";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { deduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import fs from "fs";

const fileName = "combined";
const filePath = `/Users/ramilgaripov/Desktop/metriport/full_stack/metriport/packages/utils/${fileName}.json`;

async function main() {
  // read bundle from file
  const initialBundleStr = fs.readFileSync(filePath, { encoding: "utf8" });
  const initialBundle: Bundle = JSON.parse(initialBundleStr);

  // deduplicate
  const startedAt = new Date();

  const resultingBundle = deduplicateFhir(initialBundle);

  console.log(
    `Went from ${initialBundle.entry?.length} to ${
      resultingBundle.entry?.length
    } resources in ${elapsedTimeFromNow(startedAt)} ms.`
  );

  // save
  fs.writeFileSync(`${fileName}_deduped.json`, JSON.stringify(resultingBundle));
}

main();
