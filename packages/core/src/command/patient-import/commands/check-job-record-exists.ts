import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Verify that the job record exists in S3.
 *
 * @returns true if the job record exists, throws otherwise.
 * @throws Error if the job record does not exist.
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
  const { log } = out(`PatientImport createJobRecord - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    await s3Utils.getFileInfoFromS3(s3BucketName, key);
    return true;
  } catch (error) {
    const msg = `Job record not found @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        key,
        context: "patient-import.checkJobRecordExists",
        error,
      },
    });
    throw error;
  }
}
