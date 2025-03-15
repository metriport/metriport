import { NotFoundError } from "@metriport/shared";
import { createFileKeyResults, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Verify that the results file exists in S3 and return the respective S3 key.
 *
 * @returns the key of the results file.
 * @throws NotFoundError if the results file does not exist.
 */
export async function checkResultsExistAndReturnKey({
  cxId,
  jobId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
}): Promise<string> {
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyResults(cxId, jobId);
  const exists = await s3Utils.fileExists(s3BucketName, key);
  if (!exists) {
    throw new NotFoundError("Results file not found", undefined, { cxId, jobId, s3BucketName });
  }
  return key;
}
