import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import {
  generalResources,
  resourcesSearchableByPatient,
  resourcesSearchableBySubject,
  ResourceTypeForConsolidation,
} from "@metriport/api-sdk";
import { parseS3FileName } from "@metriport/core/external/aws/s3";
import { makeFhirAdminApi, makeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { sleep } from "@metriport/shared";
import { randomInt } from "@metriport/shared/common/numbers";
import Axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import path from "path";
import { getFileContents, getFileNames, makeDir, writeFileContents } from "../shared/fs";
import { uuidv7 } from "../shared/uuid-v7";

dayjs.extend(duration);

/**
 * End-to-end test for the FHIR Converter. Requires a folder wiith C-CDA XML files. It can contain subfolders.
 *
 * IMPORTANT: This script will remove all partitions from the FHIR server! Create a backup before running it!
 * See: https://smilecdr.com/docs/fhir_repository/deleting_data.html#drop-all-data
 * Could not make it be partition/tenant aware.
 *
 * It will:
 * - convert those XMLs by calling the FHIR converter;
 * - store the conversion result as JSON files in the original folder, with a timestamp in the name;
 * - create a tenant on the FHIR server;
 * - load the JSON files resulting from the conversion into the FHIR server;
 * - display statistics (count total and by resource);
 * - stats and logs are stored in a folder with a timestamp in the name (under ./runs/fhir-converter-e2e/).
 *
 * Set:
 * - cdaLocation: the folder with the XML files;
 * - converterBaseUrl: the URL of the FHIR converter;
 * - fhirBaseUrl: the URL of the FHIR server;
 */

const cdaLocation = ``;

const converterBaseUrl = "http://localhost:8777";
const fhirBaseUrl = "http://localhost:8888";
const parallelConversions = 4;
// Execute 1 batch at a time to avoid concurrency when upserting resources (resulting in 409/Conflict), which
// lead to inconsistent results in resource creation/count.
const parallelUpsertsIntoFHIRServer = 1;

const tenantId = uuidv7();
const organizationNumber = randomInt(6);
const converterApi = Axios.create({ baseURL: converterBaseUrl });
const adminFhirApi = makeFhirAdminApi(fhirBaseUrl);
const fhirApi = makeFhirApi(tenantId, fhirBaseUrl);
const fhirApiRaw = Axios.create({ baseURL: fhirBaseUrl });

let startedAt = Date.now();
const timestamp = dayjs().toISOString();
const fhirExtension = `__${timestamp}.json`;
const logsFolderName = `runs/fhir-converter-e2e/${timestamp}`;

type Params = {
  cleanup?: boolean;
};
const program = new Command();
program
  .name("e2e-test")
  .description("End-to-end test for the FHIR Converter")
  .option(
    `--cleanup`,
    "Cleanup the FHIR server at the end. WARNING: THIS WILL REMOVE ALL PARTITIONS! Backup your data first!"
  )
  .parse()
  .showHelpAfterError();

export async function main() {
  await sleep(100);
  startedAt = Date.now();
  const { cleanup } = program.opts<Params>();

  console.log(
    `Running End-to-End tests for the FHIR Converter (cleanup: ${cleanup}) - started at ${new Date().toISOString()}`
  );
  console.log(`Log folder: ${logsFolderName}`);
  makeDir(logsFolderName);

  // Get XML files
  const ccdaFileNames = getFileNames({
    folder: cdaLocation,
    recursive: true,
    extension: "xml",
  });
  console.log(`Found ${ccdaFileNames.length} XML files.`);

  // Convert them into JSON files
  await convertCDAsToFHIR(ccdaFileNames);

  if (cleanup) await removeAllPartitionsFromFHIRServer();

  // Create tenant at FHIR server
  await createTenant();

  const fhirFileNames = getFileNames({
    folder: cdaLocation,
    recursive: true,
    extension: fhirExtension,
  });
  console.log(`Found ${fhirFileNames.length} JSON files.`);

  // Insert JSON files into FHIR server
  await insertBundlesIntoFHIRServer(fhirFileNames);

  // Get stats from FHIR Server
  const stats = await getStatusFromFHIRServer();
  console.log(`Resources: `, stats.resources);
  console.log(`Total resources: ${stats.total}`);
  writeFileContents(`${logsFolderName}/stats.json`, JSON.stringify(stats, null, 2));

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);

  return;
}

async function convertCDAsToFHIR(fileNames: string[]) {
  console.log(`Converting ${fileNames.length} files, ${parallelConversions} at a time...`);
  await executeAsynchronously(
    fileNames,
    async fileName => {
      await convert(fileName);
    },
    { numberOfParallelExecutions: parallelConversions }
  );
  const conversionDuration = Date.now() - startedAt;
  console.log(`Converted ${fileNames.length} files in ${conversionDuration} ms.`);
}

async function convert(fileName: string) {
  const patientId = getPatientIdFromFileName(fileName);
  const fileContents = getFileContents(fileName);
  try {
    const unusedSegments = false;
    const invalidAccess = false;
    const params = { patientId, fileName: "anything", unusedSegments, invalidAccess };
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
    console.log(`Error converting ${fileName}: `, error.response);
    throw error;
  }
}

function getPatientIdFromFileName(fileName: string) {
  const parts = parseS3FileName(fileName);
  if (!parts) return uuidv7();
  return parts.patientId;
}

async function createTenant() {
  const config = { cxId: tenantId, organizationNumber };
  console.log(`Creating tenant @ FHIRServer w/ ${JSON.stringify(config)}`);
  await adminFhirApi.createTenant(config);
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

async function insertBundlesIntoFHIRServer(fileNames: string[]) {
  console.log(`Inserting ${fileNames.length} files, ${parallelUpsertsIntoFHIRServer} at a time...`);
  const res = await executeAsynchronously(
    fileNames,
    async fileName => {
      await insertSingleBundle(fileName);
    },
    { numberOfParallelExecutions: parallelUpsertsIntoFHIRServer, keepExecutingOnError: true }
  );

  const failed = res.filter(r => r.status === "rejected");
  const reportFailure = failed.length ? ` [${failed.length} failed]` : "";

  const insertDuration = Date.now() - startedAt;
  console.log(`Inserted ${fileNames.length} files in ${insertDuration} ms.${reportFailure}`);
}

async function insertSingleBundle(fileName: string) {
  const fileContents = getFileContents(fileName);
  const payload = JSON.parse(fileContents ?? "");

  const response = await fhirApi.executeBatch(payload);
  const errors = getErrorsFromReponse(response);
  try {
    const shortFileName = fileName.replace(cdaLocation, "");
    createDirIfNeeded(shortFileName, logsFolderName);
    const filePrefix = `${logsFolderName}${shortFileName}`;
    writeFileContents(`${filePrefix}.response.json`, JSON.stringify(response));
  } catch (error) {
    console.log(`>>> Error writing results to ${fileName}.response.json: `, error);
  }

  if (errors.length > 0) {
    console.log(`>>> Errors: `, JSON.stringify(errors));
    throw new Error(`Got ${errors.length} errors from FHIR`);
  }
}

function createDirIfNeeded(fileName: string, base: string) {
  if (!fileName.includes("/")) return;
  const dirName = fileName.split("/").slice(0, -1).join("/");
  makeDir(path.join(base, dirName));
}

function getErrorsFromReponse(response?: Bundle<Resource>) {
  const entries = response?.entry ? response.entry : [];
  const errors = entries.filter(e => !e.response?.status?.startsWith("2"));
  return errors;
}

async function getStatusFromFHIRServer() {
  const result = await getResourceCount();
  const succeeded = result.flatMap(r => (r.status === "fulfilled" ? r.value : []));
  const failed = result.flatMap(r => (r.status === "rejected" ? r.reason : []));

  let total = 0;
  const countPerResource = succeeded.reduce((acc, curr) => {
    const resourceType = curr.resourceType;
    const count = curr.count ?? 0;
    total += count;
    if (count === 0) return acc;
    return { ...acc, [resourceType]: count };
  }, {} as Record<ResourceTypeForConsolidation, number>);

  if (failed.length) {
    console.log(
      `>>> Amount of resources that failed to count: ${failed.length} (${succeeded.length} succeeded)`
    );
  }

  return {
    total,
    resources: countPerResource,
  };
}

async function getResourceCount() {
  const { resourcesByPatient, resourcesBySubject } = getResourcesFilter();
  const summaryCount = "&_summary=count";

  const result = await Promise.allSettled([
    ...[...resourcesByPatient, ...resourcesBySubject].map(async resource => {
      const res = await fhirApi.search(resource, summaryCount);
      return { resourceType: resource, count: res.total ?? 0 };
    }),
  ]);

  return result;
}

function getResourcesFilter() {
  const resourcesByPatient = resourcesSearchableByPatient;
  const resourcesBySubject = resourcesSearchableBySubject;
  const generalResourcesNoFilter = generalResources;
  return {
    resourcesByPatient,
    resourcesBySubject,
    generalResourcesNoFilter,
  };
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
