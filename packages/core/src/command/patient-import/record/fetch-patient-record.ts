import { errorToString, MetriportError } from "@metriport/shared";
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
  throwIfNotFound = true,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  s3BucketName: string;
  throwIfNotFound?: boolean;
}): Promise<PatientRecord> {
  const { log } = out(
    `PatientImport fetchPatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    if (throwIfNotFound) {
      await checkPatientRecordExists({ cxId, jobId, patientId, s3BucketName });
    }
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
