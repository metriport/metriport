import { errorToString } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { PatientRecord } from "../patient-import";
import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";

// TODO 2330 add TSDoc
export async function fetchPatientRecord({
  cxId,
  jobId,
  patientId,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
}): Promise<PatientRecord> {
  const { log } = out(
    `PatientImport fetchPatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    const file = await s3Utils.getFileContentsAsString(s3BucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        jobId,
        patientId,
        key,
        context: "patient-import.fetchPatientRecord",
        error,
      },
    });
    throw error;
  }
}
