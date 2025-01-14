import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { createFileKeyPatient } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function checkPatientRecordExists({
  cxId,
  jobId,
  jobStartedAt,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  patientId: string;
  s3BucketName: string;
}): Promise<boolean> {
  const { log } = out(
    `PatientImport check patient record exists - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobStartedAt, jobId, patientId);
  try {
    const fileExists = await s3Utils.fileExists(s3BucketName, key);
    return fileExists;
  } catch (error) {
    const msg = `Failure while checking patient record exists @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        key,
        context: "patient-import.check-patient-record-exists",
        error,
      },
    });
    throw error;
  }
}
