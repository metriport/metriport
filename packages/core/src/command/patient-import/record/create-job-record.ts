import { errorToString, MetriportError } from "@metriport/shared";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { JobRecord } from "../patient-import";
import { createFileKeyJob, getS3UtilsInstance } from "../patient-import-shared";

/**
 * Creates the Job record on S3, the file that represents the bulk patient import parameters
 * and status.
 *
 * @returns the jobId andS3 info of the created file
 */
export async function createJobRecord(
  jobCreate: PatientImportJob
): Promise<{ jobId: string; key: string; bucketName: string }> {
  const { cxId, facilityId, id: jobId } = jobCreate;
  const { log } = out(`PatientImport createJobRecord - cxId ${cxId} facilityId ${facilityId}`);
  const s3Utils = getS3UtilsInstance();
  const key = createFileKeyJob(cxId, jobId);
  try {
    const bucketName = Config.getPatientImportBucket();
    const payload: JobRecord = {
      cxId,
      facilityId,
      jobId,
      createdAt: jobCreate.createdAt.toISOString(),
      paramsCx: jobCreate.paramsCx,
      paramsOps: jobCreate.paramsOps,
    };
    await s3Utils.uploadFile({
      bucket: bucketName,
      key,
      file: Buffer.from(JSON.stringify(payload), "utf8"),
      contentType: "application/json",
    });
    return { jobId, key, bucketName };
  } catch (error) {
    const msg = `Failure while creating job record @ PatientImport`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      key,
      context: "patient-import.createJobRecord",
    });
  }
}
