import { PatientImportPatient, patientImportSchema } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import {
  createFileKeyFiles,
  PatientImportCsvHeaders,
  compareCsvHeaders,
  normalizeHeaders,
  createObjectsFromCsv,
} from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type SupportedFileTypes = "csv";

export async function validateAndParsePatientImportCsv({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<PatientImportPatient[]> {
  const s3Utils = getS3UtilsInstance();
  const rawFileName = createFileKeyFiles(cxId, jobId, "raw");
  const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, rawFileName);
  const allRows = csvAsString.split("\n");
  const headersRow = allRows[0];
  if (!headersRow) throw new Error(`File is empty for ${rawFileName} in ${s3BucketName}`);
  const headers = normalizeHeaders(headersRow.split(","));
  if (!compareCsvHeaders(PatientImportCsvHeaders, headers)) {
    throw new Error(`Headers are invalid for ${rawFileName} in ${s3BucketName}`);
  }
  const rows = allRows.slice(1);
  if (rows.length === 0) {
    throw new Error(`File is empty except for headers for ${rawFileName} in ${s3BucketName}`);
  }
  const patients = createObjectsFromCsv({
    fileName: rawFileName,
    rows,
    headers,
  });
  const parsingOutcome = patientImportSchema.safeParse({ patients });
  if (!parsingOutcome.success) throw new Error("Invalid file");
  return parsingOutcome.data.patients;
}
