import { errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { PatientMapping } from "../patient-import";
import { createFileKeyPatientMapping, getS3UtilsInstance } from "../patient-import-shared";
import { checkPatientMappingExists } from "./check-patient-mapping-exists";

/**
 * Fetches a patient mapping from S3.
 *
 * @returns the patient mapping if it exists, undefined otherwise.
 */
export async function fetchPatientMapping({
  cxId,
  jobId,
  patientId,
  bucketName = Config.getPatientImportBucket(),
}: {
  cxId: string;
  jobId: string;
  patientId: string;
  bucketName?: string;
}): Promise<PatientMapping | undefined> {
  const { log } = out(
    `PatientImport fetchPatientMapping - cxId ${cxId} jobId ${jobId} patientId ${patientId}`
  );
  const key = createFileKeyPatientMapping(cxId, jobId, patientId);
  try {
    const fileExists = await checkPatientMappingExists({ cxId, jobId, patientId, bucketName });
    if (!fileExists) return undefined;

    const s3Utils = getS3UtilsInstance();
    const file = await s3Utils.getFileContentsAsString(bucketName, key);
    return JSON.parse(file);
  } catch (error) {
    const msg = `Failure while fetching patient mapping @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      patientId,
      key,
      context: "patient-import.fetchPatientMapping",
    });
  }
}

/**
 * Fetches a patient mapping from S3. Throws an error if it doesn't exist.
 *
 * @returns the patient mapping.
 * @throws NotFoundError if the patient mapping doesn't exist.
 */
export async function fetchPatientMappingOrFail({
  cxId,
  jobId,
  patientId,
}: {
  cxId: string;
  jobId: string;
  patientId: string;
}): Promise<PatientMapping> {
  const patientMapping = await fetchPatientMapping({ cxId, jobId, patientId });
  if (!patientMapping) {
    throw new NotFoundError(`Patient mapping not found @ PatientImport`, {
      cxId,
      jobId,
      patientId,
      context: "patient-import.fetchPatientMappingOrFail",
    });
  }
  return patientMapping;
}
