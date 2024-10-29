import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { Config } from "../../../util/config";
import { PatientRecordUpdate } from "../patient-import";
import { createFileKeyPatient } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

export async function creatOrUpdatePatientRecord({
  cxId,
  jobId,
  jobStartedAt,
  patientId,
  data = {},
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  jobStartedAt: string;
  patientId: string;
  data?: PatientRecordUpdate;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport check or patient record - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobStartedAt, jobId, patientId);
  try {
    const existingData = await getParsedFileData({
      bucket: s3BucketName,
      key,
      s3Utils,
    });
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify({ patientId, ...existingData, ...data }), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating or updating patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        key,
        context: "patient-import.create-or-update-patient-record",
        error,
      },
    });
    throw error;
  }
}

async function getParsedFileData({
  bucket,
  key,
  s3Utils,
}: {
  bucket: string;
  key: string;
  s3Utils: S3Utils;
}): Promise<PatientRecordUpdate> {
  const fileExsts = await s3Utils.fileExists(bucket, key);
  if (fileExsts) {
    const fileData = await s3Utils.getFileContentsAsString(bucket, key);
    return JSON.parse(fileData);
  }
  return {};
}
