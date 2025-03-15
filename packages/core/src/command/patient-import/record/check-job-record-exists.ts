import { NotFoundError } from "@metriport/shared";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Verify that the job record exists in S3.
 *
 * @returns true if the job record exists, false otherwise.
 */
export async function checkJobRecordExists({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<boolean> {
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  return await s3Utils.fileExists(s3BucketName, key);
}

/**
 * Verify that the job record exists in S3.
 *
 * @throws NotFoundError if the job record does not exist.
 */
export async function checkJobRecordExistsOrFail({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<boolean> {
  const jobRecordExists = await checkJobRecordExists({ cxId, jobId, s3BucketName });
  if (!jobRecordExists) {
    throw new NotFoundError("Job record not found", undefined, { cxId, jobId, s3BucketName });
  }
  return jobRecordExists;
}
