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
import { makeFhirAdminApi, makeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { sleep } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import { randomInt } from "@metriport/shared/common/numbers";
import Axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import {
  getFileContents,
  getFileNames,
  makeDir,
  makeDirIfNeeded,
  writeFileContents,
} from "../shared/fs";
import { uuidv7 } from "../shared/uuid-v7";
import { convertCDAsToFHIR } from "./convert";
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
const parallelConversions = 10;
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
const fhirExtension = `.json`;
const logsFolderName = `runs/fhir-converter-e2e/${timestamp}`;
const outputFolderName = `${logsFolderName}/output`;

type Params = {
  cleanup?: boolean;
  useFhirServer?: boolean;
};
const program = new Command();
program
  .name("e2e-test")
  .description("End-to-end test for the FHIR Converter")
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
    outputFolderName
  );
  if (nonXMLBodyCount > 0) {
    console.log(`>>> ${nonXMLBodyCount} files were skipped because they have nonXMLBody`);
  }

  if (!useFhirServer) {
    const stats = await countResourcesPerDirectory(outputFolderName, fhirExtension);
    console.log(`Resources: ${JSON.stringify(stats.countPerType, null, 2)}`);
    console.log(`Total: ${stats.total}`);
    storeStats(stats);
    return;
  }

  if (cleanup) await removeAllPartitionsFromFHIRServer();

  // Create tenant at FHIR server
  await createTenant();

  const fhirFileNames = getFileNames({
    folder: outputFolderName,
    recursive: true,
    extension: fhirExtension,
  });
  console.log(`Found ${fhirFileNames.length} JSON files.`);

  const relativeJSONFileNames = fhirFileNames.map(f => f.replace(outputFolderName, ""));

  // Insert JSON files into FHIR server
  await insertBundlesIntoFHIRServer(relativeJSONFileNames);

  // Get stats from FHIR Server
  const stats = await getStatusFromFHIRServer();
  console.log(`Resources: `, stats.resources);
  console.log(`Total resources: ${stats.total}`);
  storeStats(stats);

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);

  return;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeStats(stats: any) {
  writeFileContents(
    `${logsFolderName}/stats.json`,
    JSON.stringify(
      {
        cdaLocation: cdaLocation,
        ...stats,
      },
      null,
      2
    )
  );
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
  let errCount = 0;
  await executeAsynchronously(
    fileNames,
    async fileName => {
      try {
        await insertSingleBundle(outputFolderName + fileName);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log(`Error inserting ${fileName}: ${error.message}`);
        errCount++;
      }
    },
    { numberOfParallelExecutions: parallelUpsertsIntoFHIRServer, keepExecutingOnError: true }
  );
  const reportFailure = errCount > 0 ? ` [${errCount} errors]` : "";
  const insertDuration = Date.now() - startedAt;
  // Fhir Bundles are processed partially, so don't subtract the errors from the total
  console.log(`Inserted ${fileNames.length} files in ${insertDuration} ms.${reportFailure}`);
}

async function insertSingleBundle(fileName: string) {
  const fileContents = getFileContents(fileName);
  const payload = JSON.parse(fileContents ?? "");
  let response;
  try {
    response = await fhirApi.executeBatch(payload);

    const responseFileName = `${fileName}.response`;
    try {
      makeDirIfNeeded(responseFileName);
      writeFileContents(responseFileName, JSON.stringify(response));
    } catch (error) {
      console.log(`>>> Error writing results to ${responseFileName}: `, error);
    }
    const errors = getErrorsFromReponse(response);
    if (errors.length > 0) {
      console.log(`>>> Errors: `, JSON.stringify(errors));
      throw new Error(`Got ${errors.length} errors from FHIR`);
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const errAsString = errorToString(error);
    console.log(`Error inserting ${fileName}: ${errAsString}`);
    const errorFileName = `${fileName}.error`;
    try {
      makeDirIfNeeded(errorFileName);
      writeFileContents(errorFileName, errAsString);
    } catch (error) {
      console.log(`>>> Error writing results to ${errorFileName}: `, error);
    }
    throw error;
  }
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
