import { errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { Config } from "../../../util/config";
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
}: {
  cxId: string;
  jobId: string;
}): Promise<JobRecord | undefined> {
  const { log } = out(`PatientImport fetchJobRecord - cxId ${cxId} jobId ${jobId} `);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    const bucketName = Config.getPatientImportBucket();
    const fileExists = await checkJobRecordExistsOrFail({ cxId, jobId, s3BucketName: bucketName });
    if (!fileExists) return undefined;
    const file = await s3Utils.getFileContentsAsString(bucketName, key);
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

export async function fetchJobRecordOrFail({
  cxId,
  jobId,
}: {
  cxId: string;
  jobId: string;
}): Promise<JobRecord> {
  const jobRecord = await fetchJobRecord({ cxId, jobId });
  if (!jobRecord) {
    throw new NotFoundError(`Job record not found @ PatientImport`, {
      cxId,
      jobId,
      context: "patient-import.fetchJobRecordOrFail",
    });
  }
  return jobRecord;
}
