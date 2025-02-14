import {
  errorToString,
  GenderAtBirth,
  MetriportError,
  normalizeDate,
  normalizeExternalId,
  normalizeGender,
  toTitleCase,
} from "@metriport/shared";
import csv from "csv-parser";
import * as stream from "stream";
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

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}

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
