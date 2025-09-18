import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Command } from "commander";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
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
  const facilityMapping = await buildFacilityMapping(csvFacility);
  console.log(`Facility mapping: ${JSON.stringify(facilityMapping)}`);

  const dataMapper = new DataMapper();
  dataMapper.getCustomerData(cxId);
}

async function buildFacilityMapping(csvFacility: string): Promise<Record<string, string>> {
  const rows = await readCsv<{ facility_name: string; facility_id: string }>(csvFacility);
  return Object.fromEntries(rows.map(row => [row.facility_name, row.facility_id]));
}

program.parse(process.argv);
