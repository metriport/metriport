import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { JobRecord } from "../patient-import";
import { createFileKeyJob } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function createJobRecord({
  cxId,
  jobId,
  data,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  data: JobRecord;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(`PatientImport create job record - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify(data), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating job record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        context: "patient-import.create-job-record",
        error,
      },
    });
    throw error;
  }
}
