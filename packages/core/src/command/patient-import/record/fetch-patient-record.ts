import { errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { out } from "../../../util/log";
import { PatientRecord } from "../patient-import";
import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";
import { checkPatientRecordExists } from "./check-patient-record-exists";

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
}): Promise<PatientRecord | undefined> {
  const { log } = out(
    `PatientImport fetchPatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    const fileExists = await checkPatientRecordExists({ cxId, jobId, patientId, s3BucketName });
    if (!fileExists) return undefined;
    const file = await s3Utils.getFileContentsAsString(s3BucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      patientId,
      key,
      context: "patient-import.fetchPatientRecord",
    });
  }
}

export async function fetchPatientRecordOrFail({
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
  const patientRecord = await fetchPatientRecord({ cxId, jobId, patientId, s3BucketName });
  if (!patientRecord) {
    throw new NotFoundError(`Patient record not found @ PatientImport`, {
      cxId,
      jobId,
      patientId,
      s3BucketName,
      context: "patient-import.fetchPatientRecordOrFail",
    });
  }
  return patientRecord;
}
