import { errorToString, MetriportError } from "@metriport/shared";
import csv from "csv-parser";
import * as stream from "stream";
import { out } from "../../../util/log";
import { PatientPayload } from "../patient-import";
import { createFileKeyRaw, getS3UtilsInstance } from "../patient-import-shared";
import { createValidationFile } from "../record/create-validation-file";
import { mapCsvPatientToMetriportPatient } from "./convert-patient";

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

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}
