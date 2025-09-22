import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import fs from "fs";
import path from "path";
import { Command } from "commander";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import {
  readCsv,
  streamCsv,
  startOutputCsv,
  appendToOutputCsv,
  getCsvRunsPath,
} from "../shared/csv";
import { buildExternalIdToPatientMap } from "./shared";

/**
 * This script reads a CSV roster and ensures that each patient is associated with the correct facility,
 * by inspecting a specific column and mapping it to a facility based on a CSV file. It expects a CSV
 * directory with the following files:
 * - roster.csv: The CSV roster to validate
 * - facility.csv: The CSV with facility mapping
 *
 * Usage:
 *
 * ts-node src/patient-import/validate-facility.ts --cx-id <cxId> --csv-dir <csvDir>
 *
 * Notes:
 * - csvDir is a relative path within the "runs" directory.
 * - The roster CSV header definition below must match the headers of the roster CSV.
 * - The --dry-run flag is optional and will just validate the CSV without actually requesting any facility changes.
 * - The facility CSV headers are "facility_name" and "facility_id", where the facility name is matched against a column in the roster CSV.
 */
const program = new Command();
program
  .name("validate-facility")
  .description("Validate the facility mapping")
  .requiredOption("--cx-id <cxId>", "CX ID")
  .requiredOption("--csv-dir <csvDir>", "Relative name of runs directory containing the CSV files")
  .option("--dry-run", "Just validate the CSV without actually requesting any facility changes")
  .action(main)
  .showHelpAfterError();

const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");
const numberOfParallelRequests = 10;
const { api: metriportAPI } = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

/**
 * Specific headers for the roster CSV that can be adapted to other CSV header formats,
 * as long as the corresponding function below to retrieve the headers is also updated.
 */
const CSV_ROSTER_HEADERS = [
  "PRACTICE_ID",
  "PATIENT_ID",
  "PATIENT_FIRST_NAME",
  "PATIENT_LAST_NAME",
  "PATIENT_DOB",
  "PATIENT_SEX",
  "PATIENT_ZIP",
  "PATIENT_CITY",
  "PATIENT_STATE",
  "PATIENT_ADDRESS_1",
  "PATIENT_ADDRESS_2",
  "PATIENT_HOME_PHONE",
  "PATIENT_WORK_PHONE",
  "PATIENT_MOBILE_PHONE",
  "PATIENT_EMAIL",
] as const;
type CsvRosterHeader = (typeof CSV_ROSTER_HEADERS)[number];
type CsvRosterRow = Record<CsvRosterHeader, string>;

// Retrieve the external ID and facility name from the roster CSV row.
// Can be adapted to other CSV header formats.
function getExternalIdAndFacilityName(row: CsvRosterRow): {
  externalId: string;
  facilityName: string;
} {
  return { externalId: row.PATIENT_ID, facilityName: row.PRACTICE_ID };
}

interface FacilityChange {
  externalId: string;
  metriportPatientId: string;
  currentFacilityId: string;
  expectedFacilityId: string;
}

/**
 * Main script that validates the facility mapping for the given customer roster.
 */
async function main({ cxId, csvDir, dryRun }: { cxId: string; csvDir: string; dryRun?: boolean }) {
  // Prepare runs directory and references to file paths
  const fullCsvDir = getCsvRunsPath(csvDir);
  if (!fs.existsSync(fullCsvDir)) {
    throw new Error(`CSV directory ${fullCsvDir} does not exist in "runs" directory`);
  }

  // CSV input and output file locations
  const csvFacility = path.join(fullCsvDir, "facility.csv");
  const csvRoster = path.join(fullCsvDir, "roster.csv");
  const csvOutput = path.join(fullCsvDir, `changeset-${new Date().toISOString()}.csv`);

  // Validate that both CSV input files exist
  if (!fs.existsSync(csvFacility) || !fs.existsSync(csvRoster)) {
    throw new Error(`CSV files ${csvFacility} and ${csvRoster} must be present in ${fullCsvDir}`);
  }
  const isDryRun = Boolean(dryRun);

  // Construct mappings of existing Metriport IDs
  console.log("Building facility and external ID to patient mapping...");
  const { facilityNameToId } = await buildFacilityMapping(csvFacility);
  const externalIdToPatient = await buildExternalIdToPatientMap(cxId);

  // Write output CSV with changes
  startOutputCsv(csvOutput, [
    "externalId",
    "metriportPatientId",
    "currentFacilityId",
    "expectedFacilityId",
  ]);
  let totalFacilityChanges = 0;
  let totalPatientsNotFound = 0;
  let totalFacilityIdsNotFound = 0;
  const facilityChanges: FacilityChange[] = [];

  console.log("Processing roster to find facility changes...");
  const { rowsProcessed, errorCount } = await streamCsv<CsvRosterRow>(csvRoster, row => {
    const { externalId, facilityName } = getExternalIdAndFacilityName(row);
    const patient = externalIdToPatient[externalId];
    if (!patient) {
      totalPatientsNotFound++;
      return;
    }

    const currentFacilityId = patient.facilityIds[0];
    if (!currentFacilityId) {
      totalFacilityIdsNotFound++;
      return;
    }

    // If the facility name is not being handled by the mapping, skip this row
    const expectedFacilityId = facilityNameToId[facilityName];
    if (!expectedFacilityId) {
      return;
    }

    // Creates a change object if the current facility ID does not match the expected facility ID
    if (currentFacilityId !== expectedFacilityId) {
      facilityChanges.push({
        externalId,
        metriportPatientId: patient.id,
        currentFacilityId,
        expectedFacilityId,
      });
      appendToOutputCsv(csvOutput, [externalId, patient.id, currentFacilityId, expectedFacilityId]);
      totalFacilityChanges++;
    }
  });
  console.log(`Rows processed: ${rowsProcessed}`);
  console.log(`Error count: ${errorCount}`);
  console.log(`Total references not found: ${totalPatientsNotFound}`);
  console.log(`Total facility IDs not found: ${totalFacilityIdsNotFound}`);
  console.log(`Total facility changes required: ${totalFacilityChanges}`);

  // Apply the facility changes if not in dry run mode
  if (isDryRun) return;
  await applyFacilityChanges(facilityChanges);
}

/**
 * Applies the facility changes in parallel to the MAPI route:
 * POST /medical/v1/patient/:id/facility
 */
async function applyFacilityChanges(facilityChanges: FacilityChange[]) {
  await executeAsynchronously(
    facilityChanges,
    async change => {
      await applyFacilityChange(change);
    },
    {
      numberOfParallelExecutions: numberOfParallelRequests,
    }
  );
}

/**
 * Applies the facility change for the given change.
 */
async function applyFacilityChange(change: FacilityChange): Promise<boolean> {
  console.log(
    `Applying change for ${change.externalId} from ${change.currentFacilityId} to ${change.expectedFacilityId}`
  );
  const result = await metriportAPI.post(
    `/medical/v1/patient/${change.metriportPatientId}/facility`,
    {
      facilityIds: [change.expectedFacilityId],
    }
  );
  return result.status === 200;
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

program.parse(process.argv);
