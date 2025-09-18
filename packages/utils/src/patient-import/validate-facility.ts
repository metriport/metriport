import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

// import fs from "fs";
// import csv from "csv-parser";
import { Command } from "commander";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
import { Patient } from "@metriport/shared/domain/patient";
import { readCsv } from "../shared/csv";

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
  csvFacility,
}: {
  cxId: string;
  csvRoster: string;
  csvFacility: string;
}) {
  const { facilityIdToName } = await buildFacilityMapping(csvFacility);
  await buildExternalIdToPatientMapping(cxId, facilityIdToName);
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
    const patients = await dataMapper.getEachPatientById(cxId, existingPatientIds);
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

// async function streamRoster(csvRoster: string, handler: (row: Record<string, string>) => void): Promise<void> {
//   fs.createReadStream(csvRoster)
//     .pipe(csv())
//     .on("data", handler)
//     .on("end", () => {
//       console.log("Roster streamed");
//     })
//     .on("error", (error) => {
//       console.error("Error streaming roster", error);
//     });
// }

program.parse(process.argv);
