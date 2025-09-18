import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { Command } from "commander";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { Patient } from "@metriport/shared/domain/patient";
import { readCsv, streamCsv } from "../shared/csv";

/**
 * This script reads a CSV roster and ensures that each patient is associated with the correct facility,
 * by inspecting a specific column and mapping it to a facility based on a CSV file.
 */
const program = new Command();
program
  .name("validate-facility")
  .description("Validate the facility mapping")
  .requiredOption("--cx-id <cxId>", "CX ID")
  .requiredOption("--csv-facility <csvFacility>", "Path to a CSV with facility mapping")
  .requiredOption("--csv-roster <csvRoster>", "Path to the CSV roster")
  .action(validateFacility)
  .showHelpAfterError();

async function validateFacility({
  cxId,
  csvRoster,
  csvFacility,
}: {
  cxId: string;
  csvRoster: string;
  csvFacility: string;
}) {
  const { facilityNameToId, facilityIdToName } = await buildFacilityMapping(csvFacility);
  const externalIdToPatient = await buildExternalIdToPatientMapping(cxId, facilityIdToName);

  let totalInstancesFound = 0;
  const { rowsProcessed, errorCount } = await streamCsv<CsvRosterRow>(csvRoster, row => {
    const { externalId, facilityName } = getExternalIdAndFacilityName(row);
    const patient = externalIdToPatient[externalId];
    if (!patient) {
      throw new Error(`No patient found for external ID ${externalId}`);
    }
    const currentFacilityId = patient.facilityIds[0];
    if (!currentFacilityId) {
      throw new Error(`Patient ${externalId} has no facility ID`);
    }
    const expectedFacilityId = facilityNameToId[facilityName];
    if (currentFacilityId !== expectedFacilityId) {
      console.log(
        `Patient ${externalId} has facility ID ${currentFacilityId} but expected ${expectedFacilityId}`
      );
      totalInstancesFound++;
    }
  });
  console.log(`Rows processed: ${rowsProcessed}`);
  console.log(`Error count: ${errorCount}`);
  console.log(`Total facility changes required: ${totalInstancesFound}`);
}

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

async function buildExternalIdToPatientMapping(
  cxId: string,
  facilityIdToName: Record<string, string>
): Promise<Record<string, Patient>> {
  const dataMapper = new DataMapper();
  const facilityIds = Object.keys(facilityIdToName);
  const externalIdToPatient: Record<string, Patient> = {};

  let totalCount = 0;
  let totalWithoutExternalId = 0;

  for (const facilityId of facilityIds) {
    const facilityName = facilityIdToName[facilityId];
    const existingPatientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });
    console.log(`Existing patient IDs for facility ${facilityName}: ${existingPatientIds.length}`);
    totalCount += existingPatientIds.length;

    // Retrieve each patient to construct a mapping of external IDs
    const patients = await dataMapper.getEachPatientById(cxId, existingPatientIds, 25);
    Object.assign(
      externalIdToPatient,
      Object.fromEntries(
        patients.map(patient => {
          if (!patient.externalId) {
            console.log(`Patient ${patient.id} has no external ID`);
            totalWithoutExternalId++;
            return [patient.id, patient];
          }
          return [patient.externalId, patient];
        })
      )
    );
  }
  console.log(`Total patients processed: ${totalCount}`);
  console.log(`Total patients without external ID: ${totalWithoutExternalId}`);
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
