import { errorToString, MetriportError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { JobRecord } from "../patient-import";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Updates the Job record on S3. Do not perform any validation or business logic.
 *
 * @returns the contents of the updated file.
 */
export async function updateJobRecord(jobRecord: JobRecord): Promise<JobRecord> {
  const { cxId, jobId } = jobRecord;
  const { log } = out(`PatientImport updateJobRecord - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    const bucketName = Config.getPatientImportBucket();
    log(`Updating job record to status ${jobRecord.status}, key ${key}`);
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(jobRecord), "utf8"),
      contentType: "application/json",
    });
    return jobRecord;
  } catch (error) {
    const msg = `Failure while updating job record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.updateJobRecord",
    });
  }
}
