import { Command } from "commander";
import fs from "fs";
import { buildDayjs } from "@metriport/shared/common/date";
import { SurescriptsReplica } from "@metriport/core/external/surescripts/replica";
import { SurescriptsDataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { getSurescriptsRunsFilePath } from "./shared";

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
program.description("Converts all patient responses to FHIR bundles");
program.action(fhirConvertAllResponses);
program.showHelpAfterError();

// Produces all response files
type ListResponseFilesResponse = Awaited<ReturnType<SurescriptsReplica["listResponseFiles"]>>;
type FacilityAndPatientIds = Array<{
  facilityId: string;
  patientIds: string[];
}>;

/**
 * Gets all response files for the given customer.
 *
 * @param cxId - The customer ID
 * @param useCache - Whether to use the cache
 */
async function fhirConvertAllResponses({ cxId, useCache }: { cxId: string; useCache?: boolean }) {
  const responseFiles = await getAllResponseFiles(useCache);
  const facilityAndPatientIds = await getFacilityAndPatientIdsForCustomer(cxId);
  for (const { facilityId, patientIds } of facilityAndPatientIds) {
    const patientIdSet = new Set(patientIds);
    const responseFilesForFacility = responseFiles.filter(responseFile =>
      patientIdSet.has(responseFile.patientId)
    );
    console.log(
      `Found ${responseFilesForFacility.length} response files for facility ${facilityId}`
    );

    for (const responseFile of responseFilesForFacility) {
      console.log(`Reconverting response file ${responseFile.key}`);
    }
  }
}

async function getFacilityAndPatientIdsForCustomer(cxId: string): Promise<FacilityAndPatientIds> {
  const dataMapper = new SurescriptsDataMapper();
  const customer = await dataMapper.getCustomerData(cxId);
  const response: FacilityAndPatientIds = [];

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
  const replica = new SurescriptsReplica();
  const responseFiles = await replica.listResponseFiles();
  if (useCache) {
    writeResponseFilesToCache(responseFiles);
  }
  return responseFiles;
}

async function getResponseFilesFromCache(): Promise<ListResponseFilesResponse | undefined> {
  const cacheFile = buildResponseFileCacheName();
  if (!fs.existsSync(cacheFile)) {
    return undefined;
  }
  const cache = fs.readFileSync(cacheFile, "utf-8");
  return JSON.parse(cache) as ListResponseFilesResponse;
}

function writeResponseFilesToCache(responseFiles: ListResponseFilesResponse): void {
  const cacheFile = buildResponseFileCacheName();
  fs.writeFileSync(cacheFile, JSON.stringify(responseFiles, null, 2));
}

function buildResponseFileCacheName(): string {
  return getSurescriptsRunsFilePath(`response-keys/${buildDayjs().format("YYYY-MM-DD")}.json`);
}

export default program;
