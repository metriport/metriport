import { errorToString, MetriportError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { PatientMapping } from "../patient-import";
import { createFileKeyPatientMapping, getS3UtilsInstance } from "../patient-import-shared";

export type CreatePatientMappingParams = PatientMapping & {
  cxId: string;
  jobId: string;
  bucketName?: string;
};

/**
 * Creates a patient record in S3. If the record already exists, it updates it.
 *
 * @param cxId - The ID of the customer.
 * @param jobId - The ID of the job.
 * @param rowNumber - The row number of the patient record in the CSV file.
 * @param data - The data to create or update the patient record with.
 * @param bucketName - The name of the S3 bucket to use. If not provided, will try to retrieve
 *                     from the env vars.
 */
export async function createPatientMapping({
  cxId,
  jobId,
  rowNumber,
  patientId,
  bucketName = Config.getPatientImportBucket(),
}: CreatePatientMappingParams): Promise<void> {
  const { log } = out(`PatientImport createPatientMapping - cxId ${cxId} jobId ${jobId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyPatientMapping(cxId, jobId, patientId);
  try {
    const mapping: PatientMapping = { rowNumber, patientId };
    log(`Mapping rowNumber ${rowNumber} to patientId ${patientId}`);
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(mapping), "utf8"),
      contentType: "application/json",
    });
  } catch (error) {
    const msg = `Failure while creating patient mapping @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      rowNumber,
      key,
      context: "patient-import.createPatientMapping",
    });
  }
}
