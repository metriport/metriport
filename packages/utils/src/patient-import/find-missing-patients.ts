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
 * It outputs a CSV file with the missing patients using the same headers as the bulk import raw CSV.
 *
 * Usage:
 *
 * ts-node src/patient-import/find-missing-patients.ts --cx-id <cxId> --csv-output <csvOutput>
 *
 * Notes:
 * - csvOutput is a relative path within the "runs" directory.
 * - The bulk import header definition below must match the headers of the bulk import raw CSV.
 */
const program = new Command();
program
  .name("find-missing-patients")
  .description("Find missing patients from bulk imports")
  .requiredOption("--cx-id <cxId>", "Customer ID")
  .requiredOption("--csv-output <csvOutput>", "Output CSV file")
  .action(findMissingPatients)
  .showHelpAfterError();

// IMPORTANT:
// Change this to match the bulk import headers of the raw CSV
const BULK_IMPORT_HEADERS = [
  "externalid",
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
] as const;
type BulkImportHeader = (typeof BULK_IMPORT_HEADERS)[number];
type BulkImportRow = Record<BulkImportHeader, string>;

async function findMissingPatients({ cxId, csvOutput }: { cxId: string; csvOutput: string }) {
  console.log(`Finding missing patients for ${cxId}...`);
  const externalIdToPatient = await buildExternalIdToPatientMap(cxId);
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
  startOutputCsv(fullCsvPath, BULK_IMPORT_HEADERS);
  for (const missingPatient of missingPatients) {
    const missingPatientRow = BULK_IMPORT_HEADERS.map(header => missingPatient[header]);
    appendToOutputCsv(fullCsvPath, missingPatientRow);
  }
  console.log(`Wrote missing patients to ${fullCsvPath}`);
}

program.parse(process.argv);
