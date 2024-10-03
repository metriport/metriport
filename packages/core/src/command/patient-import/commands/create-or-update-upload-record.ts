import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { UploadRecordUpdate } from "../patient-import";
import { createFileKey } from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function creatOrUpdateUploadRecord({
  jobId,
  cxId,
  patientId,
  data = {},
  s3BucketName,
}: {
  jobId: string;
  cxId: string;
  patientId: string;
  data?: UploadRecordUpdate;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(`PatientImport check or upload record - cxId ${cxId} patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKey(cxId, jobId, patientId);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify({ patientId, ...data }), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating upload record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        context: "patient-import.create-upload-record",
        error,
      },
    });
    throw error;
  }
}
