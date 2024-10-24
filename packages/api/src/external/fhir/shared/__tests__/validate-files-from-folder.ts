import { Bundle } from "@medplum/fhirtypes";
import { getFileContents, getFileNames } from "@metriport/core/util/fs";
import { sleep } from "@metriport/shared";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { validateFhirEntries } from "../json-validator";

dayjs.extend(duration);

/**
 * Script to validate FHIR bundles on the local filesystem using the validateFhirEntries function.
 *
 * To run:
 * 1. Set the bundlesFolder variable to the path of the folder containing the FHIR bundles.
 * 2. Run the script from the packages/api folder:
 *    ts-node src/external/fhir/shared/__tests__/validate-files-from-folder.ts
 */

const bundlesFolder = "";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);
  console.log(``);

  const fileNames = getFileNames({
    folder: bundlesFolder,
    recursive: false,
    extension: "json",
  });

  fileNames.forEach(fileName => {
    try {
      console.log(`Validating file ${fileName}...`);
      const bundle = JSON.parse(getFileContents(fileName)) as Bundle;
      bundle.type = "collection";
      validateFhirEntries(bundle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(`Error validating file ${fileName}: ${error.message}`);
    }
  });
  console.log(``);
  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

function elapsedTimeAsStr(startedAt: number, finishedAt = Date.now()) {
  const ellapsedTime = dayjs.duration(finishedAt - startedAt);
  const timeInMin = formatNumber(ellapsedTime.asMinutes());
  const timeInMillis = formatNumber(ellapsedTime.asMilliseconds());
  return `${timeInMillis} millis / ${timeInMin} min`;
}

main();
