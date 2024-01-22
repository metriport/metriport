import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { parseS3FileName } from "@metriport/core/external/aws/s3";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { sleep } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import Axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  getFileContents,
  getFileContentsAsync,
  getFileNames,
  makeDir,
  writeFileContents,
} from "../shared/fs";
import { uuidv7 } from "../shared/uuid-v7";
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

const folder = "/Users/rafael/code/make-mrs";

const converterBaseUrl = "http://localhost:8777";
const parallelConversions = 4;

const converterApi = Axios.create({ baseURL: converterBaseUrl });

let startedAt = Date.now();
const timestamp = dayjs().toISOString();
const fhirExtension = `__${timestamp}.json`;
const logsFolderName = `runs/convert-and-generate-mr/${timestamp}`;
let countNonXMLBody = 0;

export async function main() {
  await sleep(100);
  startedAt = Date.now();

  console.log(
    `Convert C-CDA XML files into FHIR and generates a MR summary - started at ${new Date().toISOString()}`
  );
  console.log(`Log folder: ${logsFolderName}`);
  makeDir(logsFolderName);

  // Get XML files
  const ccdaFileNames = getFileNames({
    folder: folder,
    recursive: true,
    extension: "xml",
  });
  console.log(`Found ${ccdaFileNames.length} XML files.`);

  // Convert them into JSON files
  await convertCDAsToFHIR(ccdaFileNames);
  if (countNonXMLBody > 0) {
    console.log(`>>> ${countNonXMLBody} files were skipped because they have nonXMLBody`);
  }

  // Consolidate all bundles' resources into a single bundle
  const resources = await getResourcesPerDirectory(folder, fhirExtension);
  const bundleFileName = `${logsFolderName}/bundle.json`;
  writeFileContents(bundleFileName, JSON.stringify(resources));

  // Generate MR summary
  const html = bundleToHtml({
    resourceType: "Bundle",
    entry: resources,
  });
  const htmlFileName = `${logsFolderName}/bundle.html`;
  writeFileContents(htmlFileName, html);

  // count by looking at the files
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

async function convertCDAsToFHIR(fileNames: string[]) {
  console.log(`Converting ${fileNames.length} files, ${parallelConversions} at a time...`);
  let errCount = 0;
  const res = await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        await convert(fileName);
      } catch (error) {
        errCount++;
        throw error;
      }
    },
    { numberOfParallelExecutions: parallelConversions, keepExecutingOnError: true, verbose: false }
  );
  const failed = res.filter(r => r.status === "rejected");
  const reportFailure = errCount > 0 ? ` [${errCount} in ${failed.length} promises]` : "";

  const conversionDuration = Date.now() - startedAt;
  console.log(
    `Converted ${fileNames.length - errCount} files in ${conversionDuration} ms.${reportFailure}`
  );
}

async function convert(fileName: string) {
  const patientId = getPatientIdFromFileName(fileName);
  const fileContents = getFileContents(fileName);
  if (fileContents.includes("nonXMLBody")) {
    countNonXMLBody++;
    console.log(`Skipping ${fileName} because it has nonXMLBody`);
    return;
  }

  try {
    const unusedSegments = false;
    const invalidAccess = false;
    const params = { patientId, fileName, unusedSegments, invalidAccess };
    const url = `/api/convert/cda/ccd.hbs`;
    const payload = (fileContents ?? "").trim();
    const res = await converterApi.post(url, payload, {
      params,
      headers: { "Content-Type": "text/plain" },
    });
    const conversionResult = res.data.fhirResource;

    const destFileName = fileName.replace(".xml", fhirExtension);
    writeFileContents(destFileName, JSON.stringify(conversionResult));
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log(`Error converting ${fileName}: ${errorToString(error)}`);
    throw error;
  }
}

function getPatientIdFromFileName(fileName: string) {
  const parts = parseS3FileName(fileName);
  if (!parts) return uuidv7();
  return parts.patientId;
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
