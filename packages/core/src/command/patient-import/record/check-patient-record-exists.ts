import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Check if a patient record exists in S3.
 *
 * @returns true if the patient record exists, false otherwise.
 */
export async function checkPatientRecordExists({
  cxId,
  jobId,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
}): Promise<boolean> {
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  const fileExists = await s3Utils.fileExists(s3BucketName, key);
  return fileExists;
}
