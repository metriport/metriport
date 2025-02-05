import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { JobRecord } from "../patient-import";
import { createFileKeyJob } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function createJobRecord({
  cxId,
  jobId,
  jobStartedAt,
  data,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  data: JobRecord;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(`PatientImport createJobRecord - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobStartedAt, jobId);
  try {
    // TODO 2330 insert it into the DB as well
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
        key,
        context: "patient-import.create-job-record",
        error,
      },
    });
    throw error;
  }
}
