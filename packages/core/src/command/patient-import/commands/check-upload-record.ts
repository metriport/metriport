import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { createFileKey } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function checkUploadRecord({
  cxId,
  jobId,
  patientId,
  patientImportBucket,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  patientImportBucket: string;
}): Promise<boolean> {
  const { log } = out(
    `PatientImport check or upload record - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKey(cxId, jobId, patientId);
  try {
    const fileExists = await s3Utils.fileExists(patientImportBucket, key);
    return fileExists;
  } catch (error) {
    const msg = `Failure while checking upload record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        context: "patient-import.check-upload-record",
        error,
      },
    });
    throw error;
  }
}
