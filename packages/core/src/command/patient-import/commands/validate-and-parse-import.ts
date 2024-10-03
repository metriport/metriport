import { PatientImportPatient, patientImportSchema } from "@metriport/shared";
import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
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
  const { log } = out(`PatientImport validate and parse file - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const rawKey = createFileKeyFiles(cxId, jobId, "raw");
  try {
    const csvAsString = await s3Utils.getFileContentsAsString(s3BucketName, rawKey);
    const allRows = csvAsString.split("\n");
    const headersRow = allRows[0];
    if (!headersRow) throw new Error(`File is empty for ${rawKey}`);
    const headers = normalizeHeaders(headersRow.split(","));
    if (!compareCsvHeaders(PatientImportCsvHeaders, headers))
      throw new Error(`Headers are invalid for ${rawKey}`);
    const rows = allRows.slice(1);
    if (rows.length === 0) throw new Error(`File is empty except for headers for ${rawKey}`);
    const patients = createObjectsFromCsv({
      rows,
      headers,
    });
    const parsingOutcome = patientImportSchema.safeParse({ patients });
    if (!parsingOutcome.success) throw new Error("Invalid file");
    return parsingOutcome.data.patients;
  } catch (error) {
    const msg = `Failure validating and parsing @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        rawKey,
        context: "patient-import.validate-and-parse",
        error,
      },
    });
    throw error;
  }
}
