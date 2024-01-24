import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { sleep } from "@metriport/shared";
import Axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getFileContentsAsync, getFileNames, makeDir, writeFileContents } from "../shared/fs";
import { convertCDAsToFHIR } from "./convert";
import { countResourcesPerDirectory } from "./shared";

dayjs.extend(duration);

/**
 * Converts C-CDA XML files into FHIR and generates a MR summary.
 *
 * It will:
 * - convert XMLs by calling the FHIR converter;
 * - store the conversion result as JSON files in the original folder, with a timestamp in the name;
 * - consolidate all bundles' resources into a single bundle;
 * - convert that bundle into a MR summary;
 * - count the resources in the JSON files resulting from the conversion;
 * - display statistics (count total and by resource);
 * - stats and logs are stored in a folder with a timestamp in the name (under ./runs/fhir-converter-e2e/).
 *
 * Set:
 * - folder: the folder with the XML files;
 * - converterBaseUrl: the URL of the FHIR converter;
 */

const folder = "";

const converterBaseUrl = "http://localhost:8777";
const parallelConversions = 10;

const converterApi = Axios.create({ baseURL: converterBaseUrl });

let startedAt = Date.now();
const timestamp = dayjs().toISOString();
const fhirExtension = `.json`;
const logsFolderName = `runs/convert-and-generate-mr/${timestamp}`;
const outputFolderName = `${logsFolderName}/output`;

export async function main() {
  await sleep(100);
  startedAt = Date.now();

  console.log(
    `Convert C-CDA XML files into FHIR and generates a MR summary - started at ${new Date().toISOString()}`
  );
  console.log(`Log folder: ${logsFolderName}`);
  makeDir(logsFolderName);
  makeDir(outputFolderName);

  // Get XML files
  const ccdaFileNames = getFileNames({
    folder,
    recursive: true,
    extension: "xml",
  });
  console.log(`Found ${ccdaFileNames.length} XML files.`);

  const relativeFileNames = ccdaFileNames.map(f => f.replace(folder, ""));

  // Convert them into JSON files
  const { nonXMLBodyCount } = await convertCDAsToFHIR(
    folder,
    relativeFileNames,
    parallelConversions,
    startedAt,
    converterApi,
    fhirExtension,
    outputFolderName
  );
  if (nonXMLBodyCount > 0) {
    console.log(`>>> ${nonXMLBodyCount} files were skipped because they have nonXMLBody`);
  }

  // Consolidate all bundles' resources into a single bundle
  const resources = await getResourcesPerDirectory(folder, fhirExtension);
  const bundleFileName = `${outputFolderName}/bundle.json`;
  const bundle: Bundle<Resource> = {
    resourceType: "Bundle",
    entry: resources,
  };
  writeFileContents(bundleFileName, JSON.stringify(bundle));

  // Generate MR summary
  console.log(`Generating MR summary...`);
  const html = bundleToHtml(bundle);
  const htmlFileName = `${outputFolderName}/bundle.html`;
  console.log(`Generated, writing it to ${htmlFileName}...`);
  writeFileContents(htmlFileName, html);

  // count by looking at the files
  console.log(`Counting from folder...`);
  const stats = await countResourcesPerDirectory(folder, fhirExtension);
  console.log(`Resources: ${JSON.stringify(stats.countPerType, null, 2)}`);
  console.log(`Total: ${stats.total}`);
  storeStats(stats);

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);

  return;
}

export async function getResourcesPerDirectory(
  dirName: string,
  fileExtension = ".json"
): Promise<BundleEntry<Resource>[]> {
  console.log(`Searching for files w/ extension ${fileExtension} on ${dirName}...`);
  const fileNames = getFileNames({ folder: dirName, extension: fileExtension, recursive: true });
  console.log(`Reading ${fileNames.length} files...`);
  const resourcesByFile = await Promise.all(
    fileNames.map(async fileName => getResources(fileName))
  );
  return resourcesByFile.flat();
}

export async function getResources(fileName: string): Promise<BundleEntry<Resource>[]> {
  const contents = await getFileContentsAsync(fileName);
  const bundleTmp = JSON.parse(contents);
  const bundle = (bundleTmp.fhirResource ? bundleTmp.fhirResource : bundleTmp) as
    | Bundle
    | undefined;
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  return bundle.entry ?? [];
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeStats(stats: any) {
  writeFileContents(
    `${logsFolderName}/stats.json`,
    JSON.stringify(
      {
        folder,
        ...stats,
      },
      null,
      2
    )
  );
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
