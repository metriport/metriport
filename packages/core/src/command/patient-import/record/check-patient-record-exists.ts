import { Config } from "../../../util/config";
import { createFileKeyPatientRecord, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Check if a patient record exists in S3.
 *
 * @returns true if the patient record exists, false otherwise.
 */
export async function checkPatientRecordExists({
  cxId,
  jobId,
  rowNumber,
  bucketName = Config.getPatientImportBucket(),
}: {
  cxId: string;
  jobId: string;
  rowNumber: number;
  bucketName?: string;
}): Promise<boolean> {
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatientRecord(cxId, jobId, rowNumber);
  const fileExists = await s3Utils.fileExists(bucketName, key);
  return fileExists;
}
