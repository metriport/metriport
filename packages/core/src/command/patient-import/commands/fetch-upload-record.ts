import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { UploadRecord } from "../patient-import";
import { createFileKey } from "../shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function fetchUploadRecord({
  cxId,
  jobId,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
}): Promise<UploadRecord> {
  const { log } = out(`PatientImport check or upload record - cxId ${cxId} patientId ${patientId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKey(cxId, jobId, patientId);
  try {
    const file = await s3Utils.getFileContentsAsString(s3BucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching upload record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        context: "patient-import.fetch-upload-record",
        error,
      },
    });
    throw error;
  }
}
