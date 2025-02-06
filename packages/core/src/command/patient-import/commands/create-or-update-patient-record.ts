import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { PatientRecordUpdate } from "../patient-import";
import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";

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
        context: "patient-import.creatOrUpdatePatientRecord",
        error,
      },
    });
    throw error;
  }
}
