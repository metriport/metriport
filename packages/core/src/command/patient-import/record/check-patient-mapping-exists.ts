import { Config } from "../../../util/config";
import { createFileKeyPatientMapping, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Check if a patient mapping exists in S3.
 *
 * @returns true if the patient mapping exists, false otherwise.
 */
export async function checkPatientMappingExists({
  cxId,
  jobId,
  patientId,
  bucketName = Config.getPatientImportBucket(),
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  bucketName?: string;
}): Promise<boolean> {
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatientMapping(cxId, jobId, patientId);
  const fileExists = await s3Utils.fileExists(bucketName, key);
  return fileExists;
}
