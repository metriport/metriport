import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { PatientPayload } from "@metriport/core/command/patient-import/patient-import";
import { validateAndParsePatientImportCsv } from "@metriport/core/command/patient-import/csv/validate-and-parse-import";
import { sleep } from "@metriport/shared";
import dayjs from "dayjs";
import fs from "fs";
import { elapsedTimeAsStr } from "../shared/duration";
import { getFileContents, makeDir } from "../shared/fs";
import {
  invalidToString,
  patientCreationToString,
  patientValidationToString,
  validToString,
} from "./shared";

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

  const {
    patients: patientsFromValidation,
    headers,
    validRows,
    invalidRows,
  } = await validateAndParsePatientImportCsv({
    contents: stringBundle,
  });

  const patientsForCreate: PatientPayload[] = patientsFromValidation;

  const outputValid = headers + "\n" + validRows.map(validToString).join("\n");
  const outputInvalid = headers + ",error" + "\n" + invalidRows.map(invalidToString).join("\n");
  const outputPatientsValidation = patientsFromValidation.map(patientValidationToString).join("\n");
  const outputPatientsCreation = patientsForCreate.map(patientCreationToString).join("\n");

  fs.writeFileSync(`./${outputFolderName}/valid.csv`, outputValid);
  fs.writeFileSync(`./${outputFolderName}/invalid.csv`, outputInvalid);
  fs.writeFileSync(`./${outputFolderName}/patients-validation.csv`, outputPatientsValidation);
  fs.writeFileSync(`./${outputFolderName}/patients-creation.csv`, outputPatientsCreation);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}`);
}

main();
