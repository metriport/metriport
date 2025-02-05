import { errorToString, PatientImportPatient, patientImportPatientSchema } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import {
  compareCsvHeaders,
  createFileKeyFiles,
  createObjectFromCsv,
  normalizeHeaders,
  patientImportCsvHeaders,
} from "../patient-import-shared";
import { creatValidationFile } from "./create-validation-file";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type RowError = { rowColumns: string[]; error: string };

const eolRegex = new RegExp(/\r/g);
const commaRegex = new RegExp(/,/g);

export async function validateAndParsePatientImportCsvFromS3({
  cxId,
  jobId,
  jobStartedAt,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  s3BucketName: string;
}): Promise<PatientImportPatient[]> {
  const { log } = out(
    `PatientImport validateAndParsePatientImportCsvFromS3 - cxId ${cxId} jobId ${jobId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobStartedAt, jobId, "raw");
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, key);

    const { patients, invalidRows, validRows, headers } = await validateAndParsePatientImportCsv({
      contents: csvAsString,
    });
    await Promise.all([
      validRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
            jobStartedAt,
            stage: "valid",
            rows: [headers.join(","), ...validRows.map(rowColumn => rowColumn.join(","))],
            s3BucketName,
          })
        : async () => Promise<void>,
      invalidRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
            jobStartedAt,
            stage: "invalid",
            rows: [
              [...headers, "error"].join(","),
              ...invalidRows.map(row => [...row.rowColumns, stripCommas(row.error)].join(",")),
            ],
            s3BucketName,
          })
        : async () => Promise<void>,
    ]);
    return patients;
  } catch (error) {
    const msg = `Failure validating and parsing import @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        key,
        context: "patient-import.validate-and-parse-import",
        error,
      },
    });
    throw error;
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
  patients: PatientImportPatient[];
}> {
  const allRows = csvAsString.split("\n");
  const headersRow = allRows[0];
  if (!headersRow) throw new Error(`File is empty`);
  const headers = normalizeHeaders(stripEol(headersRow).split(","));
  if (!compareCsvHeaders(patientImportCsvHeaders, headers)) {
    throw new Error(`Headers are invalid`);
  }
  const rows = allRows.slice(1);
  if (rows.length === 0) throw new Error(`File is empty except for headers`);
  const validRows: string[][] = [];
  const invalidRows: RowError[] = [];
  const patients = rows.flatMap((row, rowIndex) => {
    const rowColumns = stripEol(row).split(",");
    if (rowColumns.length !== headers.length) {
      invalidRows.push({
        rowColumns,
        error: `Row ${rowIndex} did not split into correct number of columns`,
      });
      return [];
    }
    if (rowColumns.some(col => col.includes('"'))) {
      invalidRows.push({
        rowColumns,
        error: `Row ${rowIndex} has an unspported double-quote`,
      });
      return [];
    }
    const patientObject = createObjectFromCsv({ rowColumns, headers });
    const parsedPatient = patientImportPatientSchema.safeParse(patientObject);
    if (!parsedPatient.success) {
      invalidRows.push({
        rowColumns,
        error: `Row ${rowIndex} had zod error ${JSON.stringify(parsedPatient.error)}`,
      });
      return [];
    }
    validRows.push(rowColumns);
    return parsedPatient.data;
  });
  return { validRows, invalidRows, headers, patients };
}

function stripEol(input: string, replacement = "") {
  return input.replace(eolRegex, replacement);
}

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}
