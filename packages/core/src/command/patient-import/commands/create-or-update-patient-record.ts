import { errorToString } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { PatientRecordUpdate } from "../patient-import";
import { createFileKeyPatient } from "../patient-import-shared";

const region = Config.getAWSRegion();

function getS3UtilsInstance(): S3Utils {
  return new S3Utils(region);
}

// TODO 2330 add TSDoc
export async function creatOrUpdatePatientRecord({
  cxId,
  jobId,
  patientId,
  data = {},
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  data?: PatientRecordUpdate;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport creatOrUpdatePatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      file: Buffer.from(JSON.stringify({ patientId, ...data }), "utf8"),
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
