import { BulkUploadPatient, bulkUploadSchema } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
//import { out } from "../../util/log";

import {
  BulkUploadCsvHeaders,
  compareCsvHeaders,
  normalizeHeaders,
  createObjectsFromCsv,
} from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export type SupportedFileTypes = "csv";

export async function validateAndParseBulkUploadCsv({
  fileName,
  bucket,
}: {
  fileName: string;
  bucket: string;
}): Promise<BulkUploadPatient[]> {
  //const { log } = out(`validateBulkUploadCsv - fileName ${fileName} bucket ${bucket}`)
  const s3Utils = getS3UtilsInstance();
  const csvAsString = await s3Utils.getFileContentsAsString(bucket, fileName);
  const allRows = csvAsString.split("\n");
  const headersRow = allRows[0];
  if (!headersRow) throw new Error(`File is empty for fileName ${fileName} bucket ${bucket}`);
  const headers = normalizeHeaders(headersRow.split(","));
  if (!compareCsvHeaders(BulkUploadCsvHeaders, headers)) {
    throw new Error(`Headers are invalid for fileName ${fileName} bucket ${bucket}`);
  }
  const rows = allRows.slice(1);
  if (rows.length === 0)
    throw new Error(`File is empty except for headers for fileName ${fileName} bucket ${bucket}`);
  const patients = createObjectsFromCsv({
    fileName,
    rows,
    headers,
  });
  const parsingOutcome = bulkUploadSchema.safeParse({ patients });
  if (!parsingOutcome.success) throw new Error("Invalid file");
  return parsingOutcome.data.patients;
}

export async function getValidPatientsFromFile(
  fileName: string,
  bucket: string,
  fileType: SupportedFileTypes
) {
  if (fileType === "csv") {
    return await validateAndParseBulkUploadCsv({ fileName, bucket });
  }
  throw new Error(`Unsupported fileType  ${fileType}`);
}
