import { errorToString, MetriportError } from "@metriport/shared";
import { out } from "../../../util/log";
import { FailedPatientRecord, ParsedPatientRecord, PatientRecord } from "../patient-import";
import { createFileKeyPatientRecord, getS3UtilsInstance } from "../patient-import-shared";
import { fetchPatientRecordOrFail } from "./fetch-patient-record";

type BucketParam = {
  bucketName: string;
};

type CreatePatientRecord = PatientRecord & BucketParam;

export type UpdatePatientRecord = Pick<
  PatientRecord,
  "cxId" | "jobId" | "rowNumber" | "patientId"
> &
  (Omit<FailedPatientRecord, "patientCreate"> | Omit<ParsedPatientRecord, "patientCreate">) &
  BucketParam;

/**
 * Creates a patient record in S3.
 *
 * @see {@link CreatePatientRecord} for the main properties.
 * @param bucketName - The name of the S3 bucket to use. If not provided, will try to retrieve
 *                     from the env vars.
 */
export async function createPatientRecord({
  bucketName,
  ...patientRecord
}: CreatePatientRecord): Promise<PatientRecord> {
  const { cxId, jobId, rowNumber } = patientRecord;
  const { log } = out(
    `PatientImport createPatientRecord - cxId ${cxId} jobId ${jobId} rowNumber ${rowNumber}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatientRecord(cxId, jobId, rowNumber);
  try {
    // TODO 2330 decide if we should check if the record already exists and, if so, update it by
    // calling updatePatientRecord() or throw - or yet, just override it like we're doing now.
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(patientRecord), "utf8"),
      contentType: "application/json",
    });
    return patientRecord;
  } catch (error) {
    const msg = `Failure while creating patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      rowNumber,
      key,
      context: "patient-import.createPatientRecord",
    });
  }
}

/**
 * Updates a patient record in S3.
 *
 * @see {@link UpdatePatientRecord} for the main properties.
 * @param bucketName - The name of the S3 bucket to use. If not provided, will try to retrieve
 *                     from the env vars.
 */
export async function updatePatientRecord({
  bucketName,
  ...patientRecord
}: UpdatePatientRecord): Promise<PatientRecord> {
  const { cxId, jobId, rowNumber, patientId } = patientRecord;
  const { log } = out(
    `PatientImport updatePatientRecord - cxId ${cxId} jobId ${jobId} rowNumber ${rowNumber}`
  );
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatientRecord(cxId, jobId, rowNumber);
  try {
    const existingRecord = await fetchPatientRecordOrFail({ cxId, jobId, rowNumber, bucketName });
    if (existingRecord.status === "failed") {
      throw new Error("Cannot update a failed record");
    }
    const updatedRecord: PatientRecord =
      patientRecord.status === "failed"
        ? {
            ...existingRecord,
            status: patientRecord.status,
            reasonForCx: patientRecord.reasonForCx,
            reasonForDev: patientRecord.reasonForDev,
            ...(patientId != undefined ? { patientId } : {}),
          }
        : {
            ...existingRecord,
            status: patientRecord.status,
            ...(patientId != undefined ? { patientId } : {}),
          };
    log(
      `Updating patient record on S3, patientId ${patientId} key ${key}, status ${updatedRecord.status}`
    );
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(updatedRecord), "utf8"),
      contentType: "application/json",
    });
    return updatedRecord;
  } catch (error) {
    const msg = `Failure while updating patient record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      rowNumber,
      key,
      context: "patient-import.updatePatientRecord",
    });
  }
}
