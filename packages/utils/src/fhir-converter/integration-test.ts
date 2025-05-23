import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { sleep } from "@metriport/shared";
import Axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getFileNames, makeDir, writeFileContents } from "../shared/fs";
import { ProcessingOptions, convertCDAsToFHIR } from "./convert";
import { countResourcesPerDirectory } from "./shared";

dayjs.extend(duration);

/**
 * End-to-end test for the FHIR Converter. Requires a folder with C-CDA XML files. It can contain subfolders.
 *
 * IMPORTANT: This script will remove all partitions from the FHIR server if used with the `--use-fhir-server`
 * option! Create a backup before running it!
 * See: https://smilecdr.com/docs/fhir_repository/deleting_data.html#drop-all-data
 * Could not make it be partition/tenant aware.
 *
 * It will:
 * - convert those XMLs by calling the FHIR converter;
 * - store the conversion result as JSON files in the original folder, with a timestamp in the name;
 * - if `--use-fhir-server` is set, it will:
 *   - create a tenant on the FHIR server;
 *   - load the JSON files resulting from the conversion into the FHIR server;
 * - otherwise, it will:
 *   - count the resources in the JSON files resulting from the conversion;
 * - display statistics (count total and by resource);
 * - stats and logs are stored in a folder with a timestamp in the name (under ./runs/fhir-converter-integration/).
 *
 * Set:
 * - cdaLocation: the folder with the XML files;
 * - converterBaseUrl: the URL of the FHIR converter;
 * - fhirBaseUrl: the URL of the FHIR server;
 */

const cdaLocation = ``;
const converterBaseUrl = "http://localhost:8777";
const fhirBaseUrl = "http://localhost:8889";
const parallelConversions = 10;
// Execute 1 batch at a time to avoid concurrency when upserting resources (resulting in 409/Conflict), which
// lead to inconsistent results in resource creation/count.

const converterApi = Axios.create({ baseURL: converterBaseUrl });
const fhirApiRaw = Axios.create({ baseURL: fhirBaseUrl });

let startedAt = Date.now();
const timestamp = dayjs().toISOString();
const fhirExtension = `.json`;
const logsFolderName = `runs/fhir-converter-integration/${timestamp}`;
const outputFolderName = `${logsFolderName}/output`;
const totalResourceCountStatsLocation = `${logsFolderName}/total-resource-counts.json`;

type Params = {
  cleanup?: boolean;
  useFhirServer?: boolean;
};

const options: ProcessingOptions = {
  hydrate: false,
  normalize: false,
  processAttachments: false,
};

const program = new Command();
program
  .name("integration-test")
  .description("Integration test for the FHIR Converter")
  .option(`--use-fhir-server`, "Insert the result of the conversion on the FHIR server")
  .option(
    `--cleanup`,
    "Cleanup the FHIR server at the end. WARNING: THIS WILL REMOVE ALL PARTITIONS! Backup your data first!"
  )
  .parse()
  .showHelpAfterError();

export async function main() {
  await sleep(100);
  startedAt = Date.now();
  const { cleanup, useFhirServer } = program.opts<Params>();

  console.log(
    `Running End-to-End tests for the FHIR Converter (useFhirServer: ${useFhirServer}, cleanup: ${cleanup}) - started at ${new Date().toISOString()}`
  );
  console.log(`Log folder: ${logsFolderName}`);
  makeDir(logsFolderName);
  makeDir(outputFolderName);

  // Get XML files
  const ccdaFileNames = getFileNames({
    folder: cdaLocation,
    recursive: true,
    extension: "xml",
  });
  console.log(`Found ${ccdaFileNames.length} XML files.`);

  const relativeFileNames = ccdaFileNames.map(f => f.replace(cdaLocation, ""));

  // Convert them into JSON files
  const { nonXMLBodyCount } = await convertCDAsToFHIR(
    cdaLocation,
    relativeFileNames,
    parallelConversions,
    startedAt,
    converterApi,
    fhirExtension,
    outputFolderName,
    options
  );
  if (nonXMLBodyCount > 0) {
    console.log(`>>> ${nonXMLBodyCount} files were skipped because they have nonXMLBody`);
  }

  const totalResourceCountStats = await countResourcesPerDirectory(outputFolderName, fhirExtension);
  storeStats(totalResourceCountStats, totalResourceCountStatsLocation);
  console.log(`Resources: ${JSON.stringify(totalResourceCountStats.countPerType, null, 2)}`);
  console.log(`Total: ${totalResourceCountStats.total}`);

  if (cleanup) await removeAllPartitionsFromFHIRServer();
  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);
  // IMPORTANT leave this here since scripts greps this line to get location for diffing stats
  console.log(`File1 Location: ${totalResourceCountStatsLocation}`);
  return;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeStats(stats: any, statsLocation: string) {
  writeFileContents(
    statsLocation,
    JSON.stringify(
      {
        ...stats,
      },
      null,
      2
    )
  );
}

async function removeAllPartitionsFromFHIRServer() {
  console.log(`Removing all partitions from the FHIR Server...`);
  const payload = {
    resourceType: "Parameters",
    parameter: [
      {
        name: "expungeEverything",
        valueBoolean: true,
      },
    ],
  };
  await fhirApiRaw.post(`${fhirBaseUrl}/fhir/DEFAULT/$expunge`, payload);
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
