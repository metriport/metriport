import { Command } from "commander";
import fs from "fs";
import { buildDayjs } from "@metriport/shared/common/date";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { SurescriptsConvertPatientResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-patient-response/convert-patient-response-direct";
import { SurescriptsConvertBatchResponseHandlerDirect } from "@metriport/core/external/surescripts/command/convert-batch-response/convert-batch-response-direct";
import { getSurescriptsRunsFilePath, writeSurescriptsRunsFile } from "./shared";
import { executeAsynchronously } from "@metriport/core/util";

/**
 * Converts all patient responses to FHIR bundles for the given customer.
 *
 * Usage:
 * npm run surescripts -- fhir-convert-all --cx-id <cx-id>
 *
 * Recommended:
 * npm run surescripts -- fhir-convert-all --cx-id <cx-id> --use-cache
 *
 * Using the cache will download all S3 file keys and patient IDs for the customer into local cache files
 * within the Surescripts runs directory, which provides a significant speedup in the conversion process
 * when running this across multiple customers or multiple iterations.
 */
const program = new Command();
program.name("fhir-convert-all");
program.requiredOption("--cx-id <cx-id>", "The customer ID");
program.option("--use-cache", "Use the cache");
program.option("--dry-run", "Dry run before running the conversion");
program.description("Converts all patient responses to FHIR bundles");
program.action(fhirConvertAllResponses);
program.showHelpAfterError();

// Produces all response files
type ListResponseFilesResponse = Awaited<ReturnType<SurescriptsReplica["listResponseFiles"]>>;
type FacilityAndPatientIds = {
  facilityId: string;
  patientIds: string[];
};

/**
 * Gets all response files for the given customer.
 *
 * @param cxId - The customer ID
 * @param useCache - Whether to use the cache
 */
async function fhirConvertAllResponses({
  cxId,
  useCache,
  dryRun,
}: {
  cxId: string;
  useCache?: boolean;
  dryRun?: boolean;
}) {
  const responseFiles = await getAllResponseFiles(useCache);
  const facilityAndPatientIds = await getFacilityAndPatientIdsForCustomer(cxId);
  const facilityIdSet = new Set(facilityAndPatientIds.map(({ facilityId }) => facilityId));

  for (const { facilityId, patientIds } of facilityAndPatientIds) {
    const patientIdSet = new Set(patientIds);
    const patientResponseFiles = responseFiles.filter(responseFile =>
      patientIdSet.has(responseFile.patientId)
    );
    const batchResponseFiles = responseFiles.filter(responseFile =>
      facilityIdSet.has(responseFile.patientId)
    );

    console.log(
      `Found ${patientResponseFiles.length} patient response files and ${batchResponseFiles.length} batch response files for facility ${facilityId}`
    );
    if (dryRun) continue;

    await executeAsynchronously(patientResponseFiles, async responseFile => {
      console.log(`Reconverting patient response file ${responseFile.key}`);
      const fhirConverter = new SurescriptsConvertPatientResponseHandlerDirect();
      await fhirConverter.convertPatientResponse({
        cxId,
        facilityId,
        transmissionId: responseFile.transmissionId,
        populationId: responseFile.patientId,
      });
    });

    await executeAsynchronously(batchResponseFiles, async responseFile => {
      console.log(`Reconverting batch response file ${responseFile.key}`);
      const fhirConverter = new SurescriptsConvertBatchResponseHandlerDirect();
      await fhirConverter.convertBatchResponse({
        cxId,
        facilityId,
        transmissionId: responseFile.transmissionId,
        populationId: responseFile.patientId,
      });
    });
  }
}

async function getFacilityAndPatientIdsForCustomer(cxId: string): Promise<FacilityAndPatientIds[]> {
  const dataMapper = new SurescriptsDataMapper();
  const customer = await dataMapper.getCustomerData(cxId);
  const response: FacilityAndPatientIds[] = [];

  for (const facility of customer.facilities) {
    const facilityId = facility.id;
    const patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
    response.push({
      facilityId,
      patientIds,
    });
  }
  return response;
}

async function getAllResponseFiles(useCache?: boolean): Promise<ListResponseFilesResponse> {
  if (useCache) {
    const cachedResponse = await getResponseFilesFromCache();
    if (cachedResponse) return cachedResponse;
  }
  console.log(`Loading response file keys from S3`);
  const replica = new SurescriptsReplica();
  const responseFiles = await replica.listResponseFiles();
  if (useCache) {
    writeResponseFilesToCache(responseFiles);
  }
  console.log(`Loaded ${responseFiles.length} response file keys from S3`);
  return responseFiles;
}

async function getResponseFilesFromCache(): Promise<ListResponseFilesResponse | undefined> {
  const cacheFile = getSurescriptsRunsFilePath(getResponseKeysFileName());
  if (!fs.existsSync(cacheFile)) {
    return undefined;
  }
  const cache = fs.readFileSync(cacheFile, "utf-8");
  console.log(`Loaded ${cache.length} response file keys from cache`);
  return JSON.parse(cache) as ListResponseFilesResponse;
}

function writeResponseFilesToCache(responseFiles: ListResponseFilesResponse): void {
  const cacheFileName = getResponseKeysFileName();
  writeSurescriptsRunsFile(cacheFileName, JSON.stringify(responseFiles, null, 2));
}

function getResponseKeysFileName(): string {
  return `response-keys/${buildDayjs().format("YYYY-MM-DD")}.json`;
}

export default program;
