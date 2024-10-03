import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { createFilePathBulkUpload } from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function checkUploadRecord({
  requestId,
  cxId,
  patientId,
  bucket,
}: {
  requestId: string;
  cxId: string;
  patientId: string;
  bucket: string;
}): Promise<boolean> {
  const { log } = out(`BulkUpload check or upload record - cxId ${cxId} patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();
  const fileName = createFilePathBulkUpload(cxId, requestId, patientId);
  const key = `bulk-uploads/${fileName}`;
  try {
    const fileExists = await s3Utils.fileExists(bucket, key);
    return fileExists;
  } catch (error) {
    const msg = `Failure while checking upload record @ BulkUpload`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        requestId,
        patientId,
        context: "bulk-upload.check-upload-record",
        error,
      },
    });
    throw error;
  }
}
