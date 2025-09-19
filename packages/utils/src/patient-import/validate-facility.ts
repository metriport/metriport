import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
// import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
// import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  readCsv,
  streamCsv,
  startOutputCsv,
  appendToOutputCsv,
  getCsvRunsPath,
} from "../shared/csv";

/**
 * This script reads a CSV roster and ensures that each patient is associated with the correct facility,
 * by inspecting a specific column and mapping it to a facility based on a CSV file. It expects a CSV
 * directory with the following files:
 *
 * - roster.csv: The CSV roster to validate
 * - facility.csv: The CSV with facility mapping
 */
const program = new Command();
program
  .name("validate-facility")
  .description("Validate the facility mapping")
  .requiredOption("--cx-id <cxId>", "CX ID")
  .requiredOption("--csv-dir <csvDir>", "Relative name of runs directory containing the CSV files")
  .option("--use-cache", "Use the cache of existing Metriport IDs")
  .option("--dry-run", "Just validate the CSV without actually requesting any facility changes")
  .action(validateFacility)
  .showHelpAfterError();

// const apiUrl = getEnvVarOrFail("API_URL");
// const apiKey = getEnvVarOrFail("API_KEY");

async function validateFacility({
  cxId,
  csvDir,
  useCache,
  dryRun,
}: {
  cxId: string;
  csvDir: string;
  useCache?: boolean;
  dryRun?: boolean;
}) {
  // Prepare runs directory and references to file paths
  const fullCsvDir = getCsvRunsPath(csvDir);
  if (!fs.existsSync(fullCsvDir)) {
    throw new Error(`CSV directory ${fullCsvDir} does not exist in "runs" directory`);
  }
  const csvFacility = path.join(fullCsvDir, "facility.csv");
  const csvRoster = path.join(fullCsvDir, "roster.csv");
  if (!fs.existsSync(csvFacility) || !fs.existsSync(csvRoster)) {
    throw new Error(`CSV files ${csvFacility} and ${csvRoster} must be present in ${fullCsvDir}`);
  }
  const isDryRun = Boolean(dryRun);

  const csvOutput = path.join(fullCsvDir, `changeset-${new Date().toISOString()}.csv`);
  const patientReferenceCachePath = useCache
    ? path.join(fullCsvDir, "reference-cache.json")
    : undefined;

  // Construct mappings of existing Metriport IDs
  const { facilityNameToId } = await buildFacilityMapping(csvFacility);
  const facilityIds = Object.keys(facilityNameToId);
  const externalIdToPatient = await buildExternalIdToPatientMapping(
    cxId,
    facilityIds,
    patientReferenceCachePath
  );

  // Write output CSV with changes
  startOutputCsv(csvOutput, [
    "externalId",
    "metriportPatientId",
    "currentFacilityId",
    "expectedFacilityId",
  ]);
  let totalInstancesFound = 0;
  let totalReferencesNotFound = 0;
  let totalFacilityIdsNotFound = 0;

  const { rowsProcessed, errorCount } = await streamCsv<CsvRosterRow>(csvRoster, row => {
    const { externalId, facilityName } = getExternalIdAndFacilityName(row);
    const reference = externalIdToPatient[externalId];
    if (!reference) {
      totalReferencesNotFound++;
      return;
    }

    const currentFacilityId = reference.facilityId;
    if (!currentFacilityId) {
      totalFacilityIdsNotFound++;
      return;
    }

    const expectedFacilityId = facilityNameToId[facilityName];
    if (currentFacilityId !== expectedFacilityId) {
      appendToOutputCsv(csvOutput, [
        externalId,
        reference.patientId,
        currentFacilityId,
        expectedFacilityId,
      ]);
      totalInstancesFound++;
    }
  });
  console.log(`Rows processed: ${rowsProcessed}`);
  console.log(`Error count: ${errorCount}`);
  console.log(`Total references not found: ${totalReferencesNotFound}`);
  console.log(`Total facility IDs not found: ${totalFacilityIdsNotFound}`);
  console.log(`Total facility changes required: ${totalInstancesFound}`);

  if (isDryRun) return;

  // const metriportAPI = new MetriportMedicalApi(apiKey, {
  //   baseAddress: apiUrl,
  // });
}

/**
 * Construct both mappings from facility name to ID, and ID to name.
 */
async function buildFacilityMapping(csvFacility: string) {
  const rows = await readCsv<{ facility_name: string; facility_id: string }>(csvFacility);
  const facilityNameToId = Object.fromEntries(
    rows.map(row => [row.facility_name, row.facility_id])
  );
  const facilityIdToName = Object.fromEntries(
    rows.map(row => [row.facility_id, row.facility_name])
  );
  return { facilityNameToId, facilityIdToName };
}

/**
 * Constructs a mapping from external ID to patient reference by querying the internal
 * API for each patient in parallel, and extracting the relevant ID fields.
 */
type PatientReference = { patientId: string; externalId: string; facilityId: string };
async function buildExternalIdToPatientMapping(
  cxId: string,
  facilityIds: string[],
  cachePath?: string
): Promise<Record<string, PatientReference>> {
  if (cachePath && fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    return cache as Record<string, PatientReference>;
  }

  const dataMapper = new DataMapper();
  const externalIdToPatient: Record<string, PatientReference> = {};

  let totalCount = 0;

  for (const facilityId of facilityIds) {
    const existingPatientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
    console.log(`Existing patient IDs for facility ${facilityId}: ${existingPatientIds.length}`);
    totalCount += existingPatientIds.length;

    // Retrieve each patient to construct a mapping of external IDs
    const patients = await dataMapper.getEachPatientById(cxId, existingPatientIds, 25);
    Object.assign(
      externalIdToPatient,
      Object.fromEntries(
        patients.map(patient => {
          const externalId = patient.externalId;
          const patientId = patient.id;
          const facilityId = patient.facilityIds[0];
          return [externalId, { patientId, externalId, facilityId }];
        })
      )
    );
  }
  console.log(`Total patients processed: ${totalCount}`);
  if (cachePath) {
    fs.writeFileSync(cachePath, JSON.stringify(externalIdToPatient), "utf8");
  }

  return externalIdToPatient;
}

/**
 * Specific headers for the roster CSV that can be adapted to other CSV header formats,
 * as long as the corresponding function below to retrieve the headers is also updated.
 */
interface CsvRosterRow {
  PRACTICE_ID: string;
  PATIENT_ID: string;
  PATIENT_FIRST_NAME: string;
  PATIENT_LAST_NAME: string;
  PATIENT_DOB: string;
  PATIENT_SEX: string;
  PATIENT_ZIP: string;
  PATIENT_CITY: string;
  PATIENT_STATE: string;
  PATIENT_ADDRESS_1: string;
  PATIENT_ADDRESS_2: string;
  PATIENT_HOME_PHONE: string;
  PATIENT_WORK_PHONE: string;
  PATIENT_MOBILE_PHONE: string;
  PATIENT_EMAIL: string;
}

function getExternalIdAndFacilityName(row: CsvRosterRow): {
  externalId: string;
  facilityName: string;
} {
  return { externalId: row.PATIENT_ID, facilityName: row.PRACTICE_ID };
}

program.parse(process.argv);
