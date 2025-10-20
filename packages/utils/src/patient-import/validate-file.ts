import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { validateAndParsePatientImportCsv } from "@metriport/core/command/patient-import/csv/validate-and-parse-import";
import {
  isParsedPatientError,
  isParsedPatientSuccess,
  PatientPayload,
} from "@metriport/core/command/patient-import/patient-import";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { getFileContents, makeDir } from "../shared/fs";
import { invalidToString, patientCreationToString, validToString } from "./shared";

/**
 * Process a CSV file with patient data for bulk import.
 * Validates and normalizes it.
 * Outputs:
 * - valid rows: file with valid rows
 * - invalid rows: file with invalid rows
 * - patients-validation: file with patients as they were validated
 * - patients-creation: file with patients as they will be created
 */

const inputFileName = "";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const timestamp = dayjs().toISOString();
  const outputFolderName = `runs/bulk-import-validation/${timestamp}`;
  makeDir(outputFolderName);

  console.log(`Reading file ${inputFileName}`);
  const stringBundle = getFileContents(inputFileName);

  const { patients: patientsFromValidation, headers } = await validateAndParsePatientImportCsv({
    contents: stringBundle,
  });

  const validRows = patientsFromValidation.filter(isParsedPatientSuccess).map(validToString);
  const invalidRows = patientsFromValidation.filter(isParsedPatientError).map(invalidToString);
  const patientsForCreate: PatientPayload[] = patientsFromValidation
    .filter(isParsedPatientSuccess)
    .map(p => p.parsed);

  const outputValid = headers + "\n" + validRows.join("\n");
  const outputInvalid = headers + ",error" + "\n" + invalidRows.join("\n");
  const outputPatientsCreation = patientsForCreate.map(patientCreationToString).join("\n");

  fs.writeFileSync(`./${outputFolderName}/valid.csv`, outputValid);
  fs.writeFileSync(`./${outputFolderName}/invalid.csv`, outputInvalid);
  fs.writeFileSync(`./${outputFolderName}/creation.ndjson`, outputPatientsCreation);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
