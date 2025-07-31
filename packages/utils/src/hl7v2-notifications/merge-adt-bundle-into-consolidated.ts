import * as dotenv from "dotenv";
dotenv.config();

// keep that ^ on top
import { dangerouslyDeduplicateFhir } from "@metriport/core/fhir-deduplication/deduplicate-fhir";
import { getFileContents, makeDir } from "@metriport/core/util/fs";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import dayjs from "dayjs";

import { FhirBundleSdk } from "@metriport/fhir-sdk";
import { cloneDeep } from "lodash";
import { writeFileSync } from "fs";

/**
 * Folder with consolidated files/bundles. If the files need to be combined into a bundle
 * set createBundle, existingPatientId, and auth stuff.
 *
 * WARNING: this will overwrite the *_deduped.json files!!!
 */
const ptId = "018eb3e7-a66d-7576-8e44-cd78b8b0ae04";
const cxId = "5af0e105-9439-4c02-939b-ecf7b230b418";
const consolidatedBundlePath = `/Users/lucasdellabella/Documents/PHI/dedup/${cxId}_${ptId}_CONSOLIDATED_DATA.json`;
const adtBundlePath = "/Users/lucasdellabella/Documents/PHI/dedup/encounter.hl7.json";

/**
 * Read FHIR bundles from 'samplesFolderPath' and deduplicates the resources inside those bundles.
 *
 * Stores the output in:
 * - the source folder, with the same name and the suffix '_deduped.json'
 * - a the './runs/' folder, with the same name and the suffix '_deduped.json'
 *
 * WARNING: it will override the *_deduped.json files from the source folder!!!
 */
async function main() {
  const timestamp = dayjs().toISOString();
  const logsFolderName = `runs/merge-adt-bundle-into-consolidated/${timestamp}`;

  makeDir(logsFolderName);

  const startedAt = new Date();
  console.log("Starting deduplication at ", startedAt);

  const rawConsolidatedBundle = JSON.parse(getFileContents(consolidatedBundlePath));
  const consolidatedBundle = cloneDeep(rawConsolidatedBundle);
  dangerouslyDeduplicateFhir(consolidatedBundle, cxId, ptId);

  const adtBundle = await FhirBundleSdk.create(JSON.parse(getFileContents(adtBundlePath)));
  const joinedBundle = await (
    await FhirBundleSdk.create(consolidatedBundle)
  ).concatEntries(adtBundle);

  const initialSize = joinedBundle.total;

  const resultBundle = cloneDeep(joinedBundle.toObject());
  dangerouslyDeduplicateFhir(resultBundle, cxId, ptId);

  const { baseOnly: joinedBundleOnly, parameterOnly: resultBundleOnly } = await joinedBundle.diff(
    resultBundle
  );

  console.log("joinedBundleOnly", JSON.stringify(joinedBundleOnly.toString(), null, 2));
  console.log("resultBundleOnly", JSON.stringify(resultBundleOnly.toString(), null, 2));

  console.log(
    JSON.stringify(
      joinedBundle.getConditions().filter(c => c.code?.coding?.[0]?.code === "M48.00"),
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      (await FhirBundleSdk.create(resultBundle))
        .getConditions()
        .filter(c => c.code?.coding?.[0]?.code === "M48.00"),
      null,
      2
    )
  );

  console.log(
    `Went from ${initialSize} to ${resultBundle.entry?.length} resources in ${elapsedTimeFromNow(
      startedAt
    )} ms.`
  );

  const lastSlash = consolidatedBundlePath.lastIndexOf("/");
  const fileName = consolidatedBundlePath.slice(lastSlash + 1).split(".json")[0];
  const fileNameWithExtension = `${fileName}_deduped.json`;

  const output = JSON.stringify(resultBundle);
  writeFileSync(`${logsFolderName}/${fileNameWithExtension}`, output);
  writeFileSync(`${consolidatedBundlePath}`, output);
}

main();
