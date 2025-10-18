import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Patient, Resource } from "@medplum/fhirtypes";
import {
  resourcesSearchableByPatient,
  resourcesSearchableBySubject,
  ResourceTypeForConsolidation,
} from "@metriport/api-sdk";
import { isConvertible } from "@metriport/core/external/cda/get-file-contents";
import { makeFhirAdminApi, makeFhirApi } from "@metriport/core/external/fhir/api/api-factory";
import {
  buildCollectionBundle,
  dangerouslyAddEntriesToBundle,
} from "@metriport/core/external/fhir/bundle/bundle";
import { convertCollectionBundleToTransactionBundle } from "@metriport/core/external/fhir/bundle/convert-to-transaction-bundle";
import { dangerouslyDeduplicate } from "@metriport/core/external/fhir/consolidated/deduplicate";
import { normalize } from "@metriport/core/external/fhir/consolidated/normalize";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { sleep } from "@metriport/shared";
import { errorToString } from "@metriport/shared/common/error";
import { randomInt } from "@metriport/shared/common/numbers";
import { parseFhirBundle } from "@metriport/shared/medical";
import Axios from "axios";
import { Command } from "commander";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import fs from "fs";
import { getFileContents, getFileNames, makeDir, writeFileContents } from "../../shared/fs";
import { uuidv7 } from "../../shared/uuid-v7";
import { convertCDAsToFHIR, ProcessingOptions } from "./convert";
import { countResourcesPerDirectory, getPatientIdFromFileName } from "./shared";

dayjs.extend(duration);

/**
 * End-to-end test for the FHIR Converter. Requires a folder with C-CDA XML files. It can contain subfolders.
 *
 * ! Read this Notion guide for info: https://www.notion.so/metriport/FHIR-Converter-Scaling-Updating-and-Testing-276b51bb9040803cb796d5872a779c33
 *
 * IMPORTANT: This script will remove all partitions from the FHIR server if used with the `--use-fhir-server`
 * option!
 *
 * See "Running Locally with Docker" on the fhir-server repository: https://github.com/metriport/fhir-server
 * It mentions how to create a dedicated FHIR server instance for this test.
 *
 * If you want to use the regular FHIR server, create a backup before running it!
 * See: https://smilecdr.com/docs/fhir_repository/deleting_data.html#drop-all-data
 * (we could not make this test be partition/tenant aware, so we need to delete all data from the FHIR server).
 *
 * This script  will:
 * - convert the XMLs by calling the FHIR converter;
 * - store the conversion result as JSON files in the original folder, with a timestamp in the name;
 * - if `--use-fhir-server` is set, it will:
 *   - remove all partitions from the FHIR server;
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
 *
 * Run it with:
 *   - npm run integration-test-and-compare-total-resource-counts from the packages/utils folder.
 *
 * Monitor:
 *   - FhirConverter Server logs to see the progress of the conversion.
 */

const cdaLocation = ``;
const converterBaseUrl = "http://localhost:8777";
const fhirBaseUrl = "http://localhost:8889";
const parallelConversions = 10;

const tenantId = uuidv7();
const organizationNumber = randomInt(6);
const converterApi = Axios.create({ baseURL: converterBaseUrl });
const adminFhirApi = makeFhirAdminApi(fhirBaseUrl);
const fhirApi = makeFhirApi(tenantId, fhirBaseUrl);
const fhirApiRaw = Axios.create({ baseURL: fhirBaseUrl });

const timestamp = dayjs().toISOString();
const fhirExtension = `.json`;
const logsFolderName = `runs/fhir-converter-integration/${timestamp}`;
const outputFolderName = `${logsFolderName}/output`;
const consolidatedFolderName = `${logsFolderName}/consolidated`;
const errorFolderName = `${logsFolderName}/hapi-errors`;
const totalResourceCountStatsLocation = `${logsFolderName}/total-resource-counts.json`;
const totalResourceCountPostFHIRInsertStatsLocation = `${logsFolderName}/total-resource-counts-post-fhir-insert.json`;

type Params = {
  cleanup?: boolean;
  useFhirServer?: boolean;
};

const options: ProcessingOptions = {
  hydrate: true,
  normalize: true,
  processAttachments: false,
};

const program = new Command();
program
  .name("integration-test")
  .description("Integration test for the FHIR Converter")
  .option(
    `--use-fhir-server`,
    `Insert the result of the conversion on the FHIR server (likely want ` +
      `to run with --cleanup to remove all partitions first, to avoid ID conflicts).`
  )
  .option(
    `--cleanup`,
    `Cleanup the FHIR server before inserting data there. WARNING: THIS WILL REMOVE ALL PARTITIONS! ` +
      `Backup your data first! Only applicable when --use-fhir-server is set.`
  )
  .parse()
  .showHelpAfterError();

export async function main() {
  await sleep(100);

  const startedAt = Date.now();
  console.log(``);
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);
  console.log(``);

  const { cleanup, useFhirServer } = program.opts<Params>();
  console.log(
    `Running End-to-End tests for the FHIR Converter (useFhirServer: ${useFhirServer}, cleanup: ${cleanup})`
  );
  console.log(`Log folder: ${logsFolderName}`);
  makeDir(logsFolderName);
  makeDir(outputFolderName);
  makeDir(consolidatedFolderName);
  makeDir(errorFolderName);

  // Get XML files
  const ccdaFileNames = getFileNames({
    folder: cdaLocation,
    recursive: true,
    extension: "xml",
  });
  console.log(`Found ${ccdaFileNames.length} XML files.`);

  const nonConvertibleDocMap = new Map<string, string[]>();
  const clinicalDocuments = ccdaFileNames.flatMap(f => {
    const fileContents = getFileContents(f);
    const isConvertibleResult = isConvertible(fileContents);
    if (!isConvertibleResult.isValid) {
      const existingReasons = nonConvertibleDocMap.get(isConvertibleResult.reason) ?? [];
      if (!existingReasons.includes(f)) {
        nonConvertibleDocMap.set(isConvertibleResult.reason, [...existingReasons, f]);
      } else {
        nonConvertibleDocMap.set(isConvertibleResult.reason, [f]);
      }
      return [];
    }
    return f;
  });

  console.log(`Found ${clinicalDocuments.length} clinical documents.`);
  for (const [reason, files] of nonConvertibleDocMap.entries()) {
    console.log(`Non-convertible due to "${reason}": ${files.length} files`);
  }

  const relativeFileNames = clinicalDocuments.map(f => f.replace(cdaLocation, ""));

  console.log(`Refreshing converter templates...`);
  await converterApi.post(`/api/UpdateBaseTemplates`);

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

  if (useFhirServer) {
    const { log: fhirServerLog } = out(`FHIRServer`);
    if (cleanup) {
      await removeAllPartitionsFromFHIRServer(fhirServerLog);
    }
    await createTenant(fhirServerLog);

    const fhirFileNames = getFileNames({
      folder: outputFolderName,
      recursive: true,
      extension: fhirExtension,
    });
    console.log(`Found ${fhirFileNames.length} JSON files.`);

    const filesByPatient = groupFilesByPatient(fhirFileNames);
    console.log(`Grouped files into ${Object.keys(filesByPatient).length} patients`);

    await createAndUploadConsolidatedIntoFhirServer(filesByPatient);
  }
  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);
  // IMPORTANT leave this here since scripts greps this line to get location for diffing stats
  console.log(`File1 Location: ${totalResourceCountStatsLocation}`);
  return;
}

function groupFilesByPatient(fileNames: string[]): Record<string, string[]> {
  const filesByPatient: Record<string, string[]> = {};

  for (const fileName of fileNames) {
    const patientId = getPatientIdFromFileName(fileName);
    if (!filesByPatient[patientId]) {
      filesByPatient[patientId] = [];
    }
    filesByPatient[patientId].push(fileName);
  }

  return filesByPatient;
}

async function createAndUploadConsolidatedIntoFhirServer(filesByPatient: Record<string, string[]>) {
  console.log(
    `Creating consolidated bundles for ${Object.keys(filesByPatient).length} patients...`
  );

  for (const [patientId, fileNames] of Object.entries(filesByPatient)) {
    console.log(`Processing patient ${patientId} with ${fileNames.length} files`);
    try {
      const consolidatedBundle = await createConsolidatedBundleForPatient(patientId, fileNames);
      await uploadConsolidatedIntoFhirServer(consolidatedBundle, patientId);
      console.log(`Successfully processed patient ${patientId}`);
    } catch (error) {
      // intentionally not doing anything, this is just to be safe
    }
  }

  // Check for errors and provide summary
  const errorFiles = getFileNames({
    folder: errorFolderName,
    recursive: false,
    extension: "json",
  });

  if (errorFiles.length > 0) {
    console.log(`\n=== ERROR SUMMARY ===`);
    console.log(`Found ${errorFiles.length} patients with errors during bundle upload`);
    console.log(`Error details saved in: ${errorFolderName}`);
    console.log(`Consolidated bundles saved in: ${consolidatedFolderName}`);

    // Create error summary
    const errorSummary = {
      totalPatients: Object.keys(filesByPatient).length,
      errorCount: errorFiles.length,
      successCount: Object.keys(filesByPatient).length - errorFiles.length,
      errorFiles: errorFiles.map(f => f.replace(errorFolderName + "/", "")),
      timestamp: new Date().toISOString(),
    };

    const errorSummaryPath = `${errorFolderName}/error-summary.json`;
    writeFileContents(errorSummaryPath, JSON.stringify(errorSummary, null, 2));
    console.log(`Error summary saved to: ${errorSummaryPath}`);
  } else {
    console.log(`\n=== SUCCESS ===`);
    console.log(`All ${Object.keys(filesByPatient).length} patients processed successfully!`);
    console.log(`Consolidated bundles saved in: ${consolidatedFolderName}`);
  }

  const stats = await getStatusFromFHIRServer();
  console.log(`Resources: `, stats.resources);
  console.log(`Total resources: ${stats.total}`);
  storeStats(stats, totalResourceCountPostFHIRInsertStatsLocation);
}

async function createConsolidatedBundleForPatient(
  patientId: string,
  fileNames: string[]
): Promise<Bundle> {
  const bundle = buildCollectionBundle();

  await executeAsynchronously(
    fileNames,
    async filePath => {
      const contents = getFileContents(filePath);
      const singleConversion = parseFhirBundle(contents);
      if (!singleConversion) {
        console.log(`No valid bundle found in ${filePath}, skipping`);
        return;
      }
      dangerouslyAddEntriesToBundle(bundle, singleConversion.entry);
    },
    { numberOfParallelExecutions: 10 }
  );

  const patientResource: Patient = {
    resourceType: "Patient",
    id: patientId,
  };
  bundle.entry?.push({
    fullUrl: `Patient/${patientId}`,
    resource: patientResource,
  });

  await dangerouslyDeduplicate({ cxId: tenantId, patientId, bundle });
  const normalized = await normalize({ cxId: tenantId, patientId, bundle });

  const patientConsolidatedFolder = `${consolidatedFolderName}/${patientId}`;
  makeDir(patientConsolidatedFolder);
  const consolidatedBundlePath = `${patientConsolidatedFolder}/consolidated.json`;
  writeFileContents(consolidatedBundlePath, JSON.stringify(normalized, null, 2));
  console.log(`Saved consolidated bundle for patient ${patientId} to ${consolidatedBundlePath}`);

  return normalized;
}

/**
 * Uploads the consolidated bundle into the FHIR server and stores errors in a file.
 * NOTE: it won't throw an error if the upload fails, it will just store the error in a file.
 */
async function uploadConsolidatedIntoFhirServer(bundle: Bundle, patientId: string) {
  try {
    const transactionBundle = convertCollectionBundleToTransactionBundle({
      fhirBundle: bundle,
    });
    console.log(
      `Uploading transaction bundle for patient ${patientId} with ${
        transactionBundle.entry?.length || 0
      } entries`
    );

    const patientConsolidatedFolder = `${consolidatedFolderName}/${patientId}`;
    const transactionBundlePath = `${patientConsolidatedFolder}/transaction-bundle.json`;
    writeFileContents(transactionBundlePath, JSON.stringify(transactionBundle, null, 2));

    const response = await fhirApi.executeBatch(transactionBundle);

    const errors = getErrorsFromReponse(response);
    if (errors.length > 0) {
      console.log(`>>> Errors uploading bundle for patient ${patientId}: `, JSON.stringify(errors));
      throw new Error(`Got ${errors.length} errors from FHIR for patient ${patientId}`);
    }

    console.log(`Successfully uploaded consolidated bundle for patient ${patientId}`);
  } catch (error) {
    console.error(`Error uploading bundle for patient ${patientId}:`, error);
    const errorDetails = {
      patientId,
      timestamp: new Date().toISOString(),
      error: errorToString(error),
      originalBundleType: bundle.type,
      entryCount: bundle.entry?.length || 0,
      resourceTypes: bundle.entry?.map(e => e.resource?.resourceType).filter(Boolean) || [],
    };
    const errorFilePath = `${errorFolderName}/patient-${patientId}-error.json`;
    writeFileContents(errorFilePath, JSON.stringify(errorDetails, null, 2));
    console.log(`Saved error details to ${errorFilePath}`);
  }
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

async function createTenant(log: typeof console.log) {
  const config = { cxId: tenantId, organizationNumber };
  log(`Creating tenant @ FHIRServer w/ ${JSON.stringify(config)}`);
  try {
    await adminFhirApi.createTenant(config);
    log(`Tenant created successfully.`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    log(`Failed to create tenant:`, {
      error,
      message: error.message,
      response: error.response?.data,
    });
    throw error;
  }

  // Verify tenant creation
  try {
    const verifyResponse = await fhirApi.search("Patient", "_summary=count");
    log(`Tenant verification successful:`, {
      tenantId,
      total: verifyResponse.total,
    });
  } catch (verifyError) {
    log(`Failed to verify tenant:`, verifyError);
    throw verifyError;
  }
}

async function removeAllPartitionsFromFHIRServer(log: typeof console.log) {
  log(`Removing all partitions from the FHIR Server...`);
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
  const { resourcesByPatient, resourcesBySubject, generalResourcesNoFilter } = getResourcesFilter();
  const summaryCount = "&_summary=count";

  const result = await Promise.allSettled([
    ...[...resourcesByPatient, ...resourcesBySubject, ...generalResourcesNoFilter].map(
      async resource => {
        const res = await fhirApi.search(resource, summaryCount);
        return { resourceType: resource, count: res.total ?? 0 };
      }
    ),
  ]);

  return result;
}

function getResourcesFilter() {
  const resourcesByPatient = resourcesSearchableByPatient;
  const resourcesBySubject = resourcesSearchableBySubject;
  const generalResourcesNoFilter = [
    "Practitioner",
    "Organization",
    "Medication",
    "Location",
  ] as const;
  return {
    resourcesByPatient,
    resourcesBySubject,
    generalResourcesNoFilter,
  };
}

export async function createConsolidatedFromLocal(
  bundlesLocation: string,
  outputFolderName: string,
  patient: Patient
) {
  const startedAt = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  initPatientIdRepository(patient.id!);
  await sleep(100);

  console.log(`Creating consolidated bundle - started at ${new Date().toISOString()}`);

  const jsonFileNames = getFileNames({
    folder: bundlesLocation,
    recursive: true,
    extension: "json",
  });
  console.log(`Found ${jsonFileNames.length} JSON files.`);

  const bundle = buildCollectionBundle();
  await executeAsynchronously(
    jsonFileNames,
    async filePath => {
      const contents = getFileContents(filePath);
      const singleConversion = parseFhirBundle(contents);
      if (!singleConversion) {
        console.log(`No valid bundle found in ${filePath}, skipping`);
        return;
      }
      dangerouslyAddEntriesToBundle(bundle, singleConversion.entry);
    },
    { numberOfParallelExecutions: 10 }
  );

  bundle.entry?.push(patient);

  fs.writeFileSync(
    `${outputFolderName}/consolidated_with_dups.json`,
    JSON.stringify(bundle, null, 2)
  );

  const initialResourceCount = countResources(bundle);

  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  await dangerouslyDeduplicate({ cxId: tenantId, patientId: patient.id!, bundle });
  const normalized = await normalize({ cxId: tenantId, patientId: patient.id!, bundle });

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Total time: ${duration} ms / ${durationMin} min`);
  console.log(`File Location: ${outputFolderName}`);

  fs.writeFileSync(`${outputFolderName}/consolidated.json`, JSON.stringify(normalized, null, 2));

  console.log("countResources before", initialResourceCount);
  console.log("countResources after", countResources(normalized));
  return;
}

function initPatientIdRepository(folderName: string) {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
  }
}

function countResources(bundle: Bundle): Record<string, number> {
  const counts: Record<string, number> = {};
  bundle.entry?.forEach(entry => {
    if (!entry.resource) return;
    const resourceType: string = entry.resource.resourceType;
    counts[resourceType] = (counts[resourceType] || 0) + 1;
  });
  return counts;
}

main().then(() => {
  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
});
