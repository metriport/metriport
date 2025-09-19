import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { Command } from "commander";
import { listBulkImportJobIds, getBulkImportRawInput, buildExternalIdToPatientMap } from "./shared";
import {
  appendToOutputCsv,
  getCsvRunsPath,
  readCsvFromString,
  startOutputCsv,
} from "../shared/csv";

/**
 * This script finds missing patients from bulk imports, by searching for patients from recent
 * bulk imports that do not have a corresponding patient with the same externalId in the Metriport API.
 * It outputs a CSV file with the missing patients.
 */
const program = new Command();
program
  .name("find-missing-patients")
  .description("Find missing patients from bulk imports")
  .requiredOption("--cx-id <cxId>", "Customer ID")
  .requiredOption("--csv-output <csvOutput>", "Output CSV file")
  .action(findMissingPatients)
  .showHelpAfterError();

interface BulkImportRow {
  externalid: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender: string;
  zip: string;
  city: string;
  state: string;
  addressline1: string;
  phone1: string;
  email1: string;
}

async function findMissingPatients({ cxId, csvOutput }: { cxId: string; csvOutput: string }) {
  console.log(`Finding missing patients for ${cxId}...`);
  const externalIdToPatient = await buildExternalIdToPatientMap(cxId, 50);
  console.log(
    `Found ${Object.keys(externalIdToPatient).length} externalId to patient mappings for ${cxId}`
  );

  console.log(`Listing bulk import job IDs for ${cxId}...`);
  const bulkImports = await listBulkImportJobIds(cxId);
  console.log(`Found ${bulkImports.length} bulk import job IDs for ${cxId}`);

  let totalMissingFound = 0;
  const missingExternalId: Set<string> = new Set();
  const missingPatients: BulkImportRow[] = [];

  for (const bulkImport of bulkImports) {
    const rawInput = await getBulkImportRawInput(cxId, bulkImport);
    const inputRows = await readCsvFromString<BulkImportRow>(rawInput);
    console.log(`Found ${inputRows.length} rows in bulk import ${bulkImport}`);

    let totalMissingFoundInBulkImport = 0;
    for (const inputRow of inputRows) {
      const externalId = inputRow.externalid;
      if (externalIdToPatient[externalId] || missingExternalId.has(externalId)) {
        continue;
      }
      missingExternalId.add(externalId);
      missingPatients.push(inputRow);
      totalMissingFound++;
      totalMissingFoundInBulkImport++;
    }

    console.log(
      `Found ${totalMissingFoundInBulkImport} missing patients in bulk import ${bulkImport}`
    );
  }
  console.log(`========================================`);
  console.log(`Total missing patients found: ${totalMissingFound}`);
  console.log(`========================================`);

  const fullCsvPath = getCsvRunsPath(csvOutput);
  startOutputCsv(fullCsvPath, [
    "externalId",
    "firstname",
    "lastname",
    "dob",
    "gender",
    "zip",
    "city",
    "state",
    "addressline1",
    "phone1",
    "email1",
  ]);
  for (const missingPatient of missingPatients) {
    appendToOutputCsv(fullCsvPath, [
      missingPatient.externalid,
      missingPatient.firstname,
      missingPatient.lastname,
      missingPatient.dob,
      missingPatient.gender,
      missingPatient.zip,
      missingPatient.city,
      missingPatient.state,
      missingPatient.addressline1,
      missingPatient.phone1,
      missingPatient.email1,
    ]);
  }
  console.log(`Wrote missing patients to ${fullCsvPath}`);
}

program.parse(process.argv);
