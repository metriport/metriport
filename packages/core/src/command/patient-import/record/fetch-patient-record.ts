import { errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { PatientRecord } from "../patient-import";
import { createFileKeyPatientRecord, getS3UtilsInstance } from "../patient-import-shared";
import { checkPatientRecordExists } from "./check-patient-record-exists";

/**
 * Fetches a patient record from S3.
 *
 * @returns the patient record if it exists, undefined otherwise.
 */
export async function fetchPatientRecord({
  cxId,
  jobId,
  rowNumber,
  bucketName = Config.getPatientImportBucket(),
}: {
  cxId: string;
  jobId: string;
  rowNumber: number;
  bucketName?: string | undefined;
}): Promise<PatientRecord | undefined> {
  const { log } = out(
    `PatientImport fetchPatientRecord - cxId ${cxId} jobId ${jobId} rowNumber ${rowNumber}`
  );
  const key = createFileKeyPatientRecord(cxId, jobId, rowNumber);
  try {
    const fileExists = await checkPatientRecordExists({ cxId, jobId, rowNumber, bucketName });
    if (!fileExists) return undefined;

    const s3Utils = getS3UtilsInstance();
    const file = await s3Utils.getFileContentsAsString(bucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      rowNumber,
      key,
      context: "patient-import.fetchPatientRecord",
    });
  }
}

/**
 * Fetches a patient record from S3. Throws an error if it doesn't exist.
 *
 * @returns the patient record.
 * @throws NotFoundError if the patient record doesn't exist.
 */
export async function fetchPatientRecordOrFail({
  cxId,
  jobId,
  rowNumber,
  bucketName,
}: {
  cxId: string;
  jobId: string;
  rowNumber: number;
  bucketName?: string | undefined;
}): Promise<PatientRecord> {
  const patientRecord = await fetchPatientRecord({ cxId, jobId, rowNumber, bucketName });
  if (!patientRecord) {
    throw new NotFoundError(`Patient record not found @ PatientImport`, {
      cxId,
      jobId,
      rowNumber,
      context: "patient-import.fetchPatientRecordOrFail",
    });
  }
  return patientRecord;
}
