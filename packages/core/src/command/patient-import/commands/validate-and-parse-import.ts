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

type rowError = { row: string; error: string };

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
    const headers = normalizeHeaders(headersRow.split(","));
    if (!compareCsvHeaders(PatientImportCsvHeaders, headers)) {
      throw new Error(`Headers are invalid for ${key}`);
    }
    const rows = allRows.slice(1);
    if (rows.length === 0) throw new Error(`File is empty except for headers for ${key}`);
    const validRows: string[] = [];
    const invalidRows: rowError[] = [];
    const patients = rows.flatMap((row, rowIndex) => {
      const rowColumns = row.split(",");
      if (rowColumns.length !== headers.length) {
        invalidRows.push({
          row,
          error: `Row ${rowIndex} did not split into correct number of columns.`,
        });
        return [];
      }
      const patientObject = createObjectFromCsv({ rowColumns, headers });
      const parsedPatient = patientImportPatientSchema.safeParse(patientObject);
      if (!parsedPatient.success) {
        invalidRows.push({
          row,
          error: `Row ${rowIndex} had zod error ${errorToString(parsedPatient.error).replace(
            "\n",
            ""
          )}`,
        });
        return [];
      }
      validRows.push(row);
      return parsedPatient.data;
    });
    await Promise.all([
      validRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
            stage: "valid",
            rows: [headers.join(","), ...validRows],
            s3BucketName,
          })
        : async () => Promise<void>,
      invalidRows.length > 0
        ? creatValidationFile({
            cxId,
            jobId,
            stage: "invalid",
            rows: [
              `${headers.join(",")},error`,
              ...invalidRows.map(row => `${row.row},${row.error}`),
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
