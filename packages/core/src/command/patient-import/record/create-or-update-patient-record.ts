import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { PatientRecordUpdate } from "../patient-import";
import { createFileKeyPatient, getS3UtilsInstance } from "../patient-import-shared";
import { fetchPatientRecord } from "./fetch-patient-record";

// TODO 2330 add TSDoc
export async function creatOrUpdatePatientRecord({
  cxId,
  jobId,
  patientId,
  data,
  s3BucketName,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  data: PatientRecordUpdate;
  s3BucketName: string;
}): Promise<void> {
  const { log } = out(
    `PatientImport creatOrUpdatePatientRecord - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatient(cxId, jobId, patientId);
  try {
    const existingRecord = await fetchPatientRecord({
      cxId,
      jobId,
      patientId,
      s3BucketName,
    });
    const updatedRecord = { ...existingRecord, ...data, patientId };
    await s3Utils.uploadFile({
      bucket: s3BucketName,
      key,
      content: Buffer.from(JSON.stringify(updatedRecord), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating or updating patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      patientId,
      key,
      context: "patient-import.creatOrUpdatePatientRecord",
    });
  }
}
