import {
  errorToString,
  GenderAtBirth,
  MetriportError,
  normalizeDate,
  normalizeExternalId,
  normalizeGender,
  normalizeUSStateForAddressSafe,
  toTitleCase,
} from "@metriport/shared";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import csv from "csv-parser";
import * as stream from "stream";
import {
  createDriversLicensePersonalIdentifier,
  createSsnPersonalIdentifier,
  PersonalIdentifier,
} from "../../../domain/patient";
import { out } from "../../../util/log";
import { PatientPayload } from "../patient-import";
import { createFileKeyRaw, getS3UtilsInstance } from "../patient-import-shared";
import { createValidationFile } from "../record/create-validation-file";
import { mapCsvAddresses } from "./address";
import { mapCsvContacts } from "./contact";

export type RowError = { rowColumns: string[]; error: string };

const MAX_NUMBER_ROWS = 100_000;
const commaRegex = new RegExp(/,/g);

// TODO 2330 add TSDoc
export async function validateAndParsePatientImportCsvFromS3({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<PatientPayload[]> {
  const { log } = out(
    `PatientImport validateAndParsePatientImportCsvFromS3 - cxId ${cxId} jobId ${jobId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyRaw(cxId, jobId);
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, key);

    const { patients, invalidRows, validRows, headers } = await validateAndParsePatientImportCsv({
      contents: csvAsString,
    });
    await Promise.all([
      validRows.length > 0
        ? createValidationFile({
            cxId,
            jobId,
            stage: "valid",
            rows: [headers.join(","), ...validRows.map(rowColumn => rowColumn.join(","))],
            s3BucketName,
          })
        : async () => Promise<void>,
      invalidRows.length > 0
        ? createValidationFile({
            cxId,
            jobId,
            stage: "invalid",
            rows: [
              [...headers, "error"].join(","),
              ...invalidRows.map(row => [...row.rowColumns, stripCommas(row.error, ";")].join(",")),
            ],
            s3BucketName,
          })
        : async () => Promise<void>,
    ]);
    return patients;
  } catch (error) {
    const msg = `Failure validating and parsing import @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.validateAndParsePatientImportCsvFromS3",
    });
  }
}

/**
 * Validates and parses a CSV string containing patient data for bulk import.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case.
 *
 * @param csvAsString - The CSV file contents as a string.
 * @returns An object containing the parsed patients, valid rows, invalid rows, and headers.
 */
export async function validateAndParsePatientImportCsv({
  contents: csvAsString,
}: {
  contents: string;
}): Promise<{
  validRows: string[][];
  invalidRows: RowError[];
  headers: string[];
  patients: PatientPayload[];
}> {
  let numberOfRows = 0;
  const promise = new Promise<{
    validRows: string[][];
    invalidRows: RowError[];
    headers: string[];
    patients: PatientPayload[];
  }>(function (resolve, reject) {
    const validRows: string[][] = [];
    const invalidRows: RowError[] = [];
    const patients: PatientPayload[] = [];
    const headers: string[] = [];
    const mappingErrors: Array<{ row: string; errors: string }> = [];
    const s = new stream.Readable();
    s.push(csvAsString);
    // indicates end-of-file basically - the end of the stream
    s.push(null);
    s.pipe(
      csv({
        mapHeaders: ({ header }: { header: string }) => {
          //eslint-disable-next-line
          return header.replace(/[!@#$%^&*()+=\[\]\\';,./{}|":<>?~_\s]/gi, "").toLowerCase();
        },
      })
    )
      .on("headers", async (parsedHeaders: string[]) => {
        headers.push(...parsedHeaders);
      })
      .on("data", async data => {
        if (++numberOfRows > MAX_NUMBER_ROWS) {
          throw new MetriportError(`CSV has more rows than max (${MAX_NUMBER_ROWS})`);
        }
        const raw = Object.values(data) as string[];
        const result = mapCsvPatientToMetriportPatient(data);
        if (Array.isArray(result)) {
          invalidRows.push({
            rowColumns: raw,
            error: result.map(e => e.error).join("; "),
          });
          mappingErrors.push({
            row: JSON.stringify(data),
            errors: result.map(e => e.error).join("; "),
          });
        } else {
          validRows.push(raw);
          patients.push(result);
        }
      })
      .on("end", async () => {
        return resolve({ patients: patients, validRows, headers, invalidRows });
      })
      .on("error", reject);
  });
  return await promise;
}

/**
 * Maps a record/map of CSV patient data to a Metriport patient.
 *
 * NOTE: when parsing columns, csv-parser populates them in lower-case, so
 * the property names are all lower-case.
 *
 * @param csvPatient - The CSV patient data.
 * @returns The Metriport patient data.
 */
export function mapCsvPatientToMetriportPatient(
  csvPatient: Record<string, string>
): PatientPayload | Array<{ field: string; error: string }> {
  const errors: Array<{ field: string; error: string }> = [];

  let firstName: string | undefined = undefined;
  try {
    firstName = normalizeName(csvPatient.firstname, "firstname");
    if (!firstName) throw new Error(`Missing firstName`);
  } catch (error) {
    errors.push({
      field: "firstName",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let lastName: string | undefined = undefined;
  try {
    lastName = normalizeName(csvPatient.lastname, "lastname");
    if (!lastName) throw new Error(`Missing lastName`);
  } catch (error) {
    errors.push({
      field: "lastName",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let dob: string | undefined = undefined;
  try {
    dob = normalizeDate(csvPatient.dob ?? "");
    if (!dob) throw new Error(`Missing dob`);
  } catch (error) {
    errors.push({ field: "dob", error: error instanceof Error ? error.message : String(error) });
  }

  let genderAtBirth: GenderAtBirth | undefined = undefined;
  try {
    genderAtBirth = normalizeGender(csvPatient.gender ?? "");
    if (!genderAtBirth) throw new Error(`Missing gender`);
  } catch (error) {
    errors.push({ field: "gender", error: error instanceof Error ? error.message : String(error) });
  }

  const { addresses, errors: addressErrors } = mapCsvAddresses(csvPatient);
  errors.push(...addressErrors);

  const { contacts, errors: contactErrors } = mapCsvContacts(csvPatient);
  errors.push(...contactErrors);

  const externalId = csvPatient.id
    ? normalizeExternalIdUtils(csvPatient.id)
    : normalizeExternalIdUtils(csvPatient.externalid) ?? undefined;

  const ssn = mapCsvSsn(csvPatient);
  const driversLicense = mapCsvDriversLicense(csvPatient);
  const personalIdentifiers: PersonalIdentifier[] = [ssn, driversLicense].flatMap(filterTruthy);

  if (errors.length > 0) {
    return errors;
  }
  if (!firstName || !lastName || !dob || !genderAtBirth || addresses.length < 1) {
    return [{ field: "general", error: "Missing required fields" }];
  }
  return {
    externalId,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address: addresses,
    contact: contacts,
    personalIdentifiers,
  };
}

export function normalizeName(name: string | undefined, propName: string): string {
  if (name == undefined) throw new Error(`Missing ` + propName);
  return toTitleCase(name);
}

export function normalizeExternalIdUtils(id: string | undefined): string | undefined {
  if (id == undefined) return undefined;
  const normalId = normalizeExternalId(id);
  if (normalId.length === 0) return undefined;
  return normalId;
}

export function mapCsvSsn(csvPatient: Record<string, string>): PersonalIdentifier | undefined {
  if (!csvPatient.ssn) return undefined;
  return createSsnPersonalIdentifier(csvPatient.ssn);
}

export function mapCsvDriversLicense(
  csvPatient: Record<string, string>
): PersonalIdentifier | undefined {
  const value = csvPatient.driverslicenceno;
  const state = csvPatient.driverslicencestate;
  const normalizedValue = value?.trim().toLowerCase();
  const normalizedState = state?.trim().toLowerCase();
  if (!normalizedValue || !normalizedState) return undefined;
  const parsedState = normalizeUSStateForAddressSafe(normalizedState);
  if (!parsedState) return undefined;
  return createDriversLicensePersonalIdentifier(normalizedValue, parsedState);
}

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}
