import { PatientImportPatient, patientImportSchema } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";

import {
  PatientImportCsvHeaders,
  compareCsvHeaders,
  normalizeHeaders,
  createObjectsFromCsv,
} from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type SupportedFileTypes = "csv";

export async function validateAndParsePatientImportCsv({
  s3BucketName,
  s3FileName,
}: {
  s3BucketName: string;
  s3FileName: string;
}): Promise<PatientImportPatient[]> {
  const s3Utils = getS3UtilsInstance();
  const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, s3FileName);
  const allRows = csvAsString.split("\n");
  const headersRow = allRows[0];
  if (!headersRow) throw new Error(`File is empty for ${s3FileName} in ${s3BucketName}`);
  const headers = normalizeHeaders(headersRow.split(","));
  if (!compareCsvHeaders(PatientImportCsvHeaders, headers)) {
    throw new Error(`Headers are invalid for ${s3FileName} in ${s3BucketName}`);
  }
  const rows = allRows.slice(1);
  if (rows.length === 0) {
    throw new Error(`File is empty except for headers for ${s3FileName} in ${s3BucketName}`);
  }
  const patients = createObjectsFromCsv({
    fileName: s3FileName,
    rows,
    headers,
  });
  const parsingOutcome = patientImportSchema.safeParse({ patients });
  if (!parsingOutcome.success) throw new Error("Invalid file");
  return parsingOutcome.data.patients;
}

export async function getValidPatientsFromImport({
  s3BucketName,
  s3FileName,
  fileType,
}: {
  s3BucketName: string;
  s3FileName: string;
  fileType: SupportedFileTypes;
}) {
  if (fileType === "csv") {
    return await validateAndParsePatientImportCsv({ s3BucketName, s3FileName });
  }
  throw new Error(`Unsupported fileType  ${fileType}`);
}
