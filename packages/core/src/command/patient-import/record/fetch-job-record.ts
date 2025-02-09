import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { JobRecord } from "../patient-import";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";
import { checkJobRecordExistsOrFail } from "./check-job-record-exists";

/**
 * Returns the Job record from S3. It includes information about the bulk patient import job.
 *
 * @see JobRecord
 * @returns the JobRecord
 */
export async function fetchJobRecord({
  cxId,
  jobId,
  s3BucketName,
  throwIfNotFound = true,
}: {
  cxId: string;
  jobId: string;
  s3BucketName: string;
  throwIfNotFound?: boolean;
}): Promise<JobRecord> {
  const { log } = out(`PatientImport fetchJobRecord - cxId ${cxId} jobId ${jobId} `);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    if (throwIfNotFound) {
      await checkJobRecordExistsOrFail({ cxId, jobId, s3BucketName });
    }
    const file = await s3Utils.getFileContentsAsString(s3BucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching job record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.fetchJobRecord",
    });
  }
}
