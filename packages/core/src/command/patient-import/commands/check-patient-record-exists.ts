import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";

// TODO 2330 add TSDoc
export async function checkPatientRecordExists({
  cxId,
  jobId,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
}): Promise<boolean> {
  const { log } = out(
    `PatientImport checkPatientRecordExists - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
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
        context: "patient-import.checkPatientRecordExists",
        error,
      },
    });
    throw error;
  }
}
