import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { UploadRecordUpdate } from "../bulk-upload";
import { createFilePathBulkUpload } from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function creatOrUpdateUploadRecord({
  requestId,
  cxId,
  patientId,
  data = {},
  bucket,
}: {
  requestId: string;
  cxId: string;
  patientId: string;
  data?: UploadRecordUpdate;
  bucket: string;
}): Promise<void> {
  const { log } = out(`BulkUpload check or upload record - cxId ${cxId} patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();
  const fileName = createFilePathBulkUpload(cxId, requestId, patientId);
  const key = `bulk-uploads/${fileName}`;
  try {
    await s3Utils.uploadFile({
      bucket,
      key,
      file: Buffer.from(JSON.stringify({ patientId, ...data }), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating upload record @ BulkUpload`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        requestId,
        patientId,
        context: "bulk-upload.create-upload-record",
        error,
      },
    });
    throw error;
  }
}
