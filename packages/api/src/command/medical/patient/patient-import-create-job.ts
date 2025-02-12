import { createFileKeyRaw } from "@metriport/core/command/patient-import/patient-import-shared";
import { createJobRecord } from "@metriport/core/command/patient-import/record/create-job-record";
import { PatientImportStatus } from "@metriport/core/domain/patient/patient-import";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config as CoreConfig } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import { Config } from "../../../shared/config";
import { getOptionalFacilityOrFail } from "../facility/get-facility";

export type BulkPatientCreateParams = {
  cxId: string;
  facilityId?: string | undefined;
  dryRun?: boolean | undefined;
};

export type CreatePatientImportResponse = {
  jobId: string;
  facilityId: string;
  status: PatientImportStatus;
  uploadUrl: string;
  params: {
    dryRun: boolean;
  };
};

/**
 * Initializes a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param facilityId - The facility ID (optional).
 * @param dryRun - Whether to simply validate the bundle or actually import it (optional, defaults to false).
 * @returns the bulk import job ID and the URL to upload the CSV file.
 * @throws BadRequestError if no facility ID is provided and there's more than one facility for the customer.
 */
export async function createPatientImportJob({
  cxId,
  facilityId,
  dryRun = false,
}: BulkPatientCreateParams): Promise<CreatePatientImportResponse> {
  const { log } = out(
    `createPatientImport - cxId ${cxId}, facilityId ${facilityId}, dryRun ${dryRun}`
  );
  const facility = await getOptionalFacilityOrFail(cxId, facilityId);

  const s3Utils = new S3Utils(Config.getAWSRegion());
  const s3BucketName = CoreConfig.getPatientImportBucket();

  const jobId = uuidv7();
  const jobStartedAt = buildDayjs().toISOString();
  const jobStatus: PatientImportStatus = "waiting";

  const { bucket } = await createJobRecord({
    cxId,
    jobId,
    data: {
      cxId,
      facilityId: facility.id,
      jobStartedAt,
      dryRun,
      status: jobStatus,
    },
    s3BucketName,
  });

  const key = createFileKeyRaw(cxId, jobId);
  const s3Url = await s3Utils.getPresignedUploadUrl({
    bucket,
    key,
    durationSeconds: dayjs.duration(10, "minutes").asSeconds(),
  });

  log(`Initialized job ${jobId} for facility ${facility.id}, key ${key}`);

  const resp: CreatePatientImportResponse = {
    jobId,
    facilityId: facility.id,
    status: jobStatus,
    uploadUrl: s3Url,
    params: {
      dryRun,
    },
  };
  return resp;
}
