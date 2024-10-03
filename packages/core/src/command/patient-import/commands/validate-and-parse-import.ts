import { PatientImportPatient, patientImportPatientSchema } from "@metriport/shared";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { creatValidationFile } from "./create-validation-file";
import {
  createFileKeyFiles,
  PatientImportCsvHeaders,
  compareCsvHeaders,
  normalizeHeaders,
  createObjectFromCsv,
} from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

type rowError = { rowColumns: string[]; error: string };

const eolRegex = new RegExp(/\r/g);
const commaRegex = new RegExp(/,/g);

export async function validateAndParsePatientImportCsv({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<PatientImportPatient[]> {
  const { log } = out(`PatientImport validate and parse import - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyFiles(cxId, jobId, "raw");
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, key);
    const allRows = csvAsString.split("\n");
    const headersRow = allRows[0];
    if (!headersRow) throw new Error(`File is empty for ${key}`);
    const headers = normalizeHeaders(stripEol(headersRow).split(","));
    if (!compareCsvHeaders(PatientImportCsvHeaders, headers)) {
      throw new Error(`Headers are invalid for ${key}`);
    }
    const rows = allRows.slice(1);
    if (rows.length === 0) throw new Error(`File is empty except for headers for ${key}`);
    const validRows: string[][] = [];
    const invalidRows: rowError[] = [];
    const patients = rows.flatMap((row, rowIndex) => {
      const rowColumns = stripEol(row).split(",");
      console.log(rowColumns);
      if (rowColumns.length !== headers.length) {
        invalidRows.push({
          rowColumns,
          error: `Row ${rowIndex} did not split into correct number of columns`,
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
    console.log(invalidRows);
    await Promise.all([
      validRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
            stage: "valid",
            rows: [headers.join(","), ...validRows.map(rowColumn => rowColumn.join(","))],
            s3BucketName,
          })
        : async () => Promise<void>,
      invalidRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
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

function stripEol(input: string, replacement = "") {
  return input.replace(eolRegex, replacement);
}

function stripCommas(input: string, replacement = "") {
  return input.replace(commaRegex, replacement);
}
