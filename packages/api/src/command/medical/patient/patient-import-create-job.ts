import { JobRecordParams } from "@metriport/core/command/patient-import/patient-import";
import { createFileKeyRaw } from "@metriport/core/command/patient-import/patient-import-shared";
import {
  createJobRecord,
  CreateJobRecordParams,
} from "@metriport/core/command/patient-import/record/create-job-record";
import {
  PatientImportParams,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../shared/config";
import { getOptionalFacilityOrFail } from "../facility/get-facility";

dayjs.extend(duration);

const presignedUploadUrlDuration = dayjs.duration(10, "minutes");

export type PatientImportCreateCmd = {
  cxId: string;
  facilityId?: string | undefined;
  params?: Partial<PatientImportParams>;
};

export type PatientImportCreateResponse = {
  jobId: string;
  facilityId: string;
  status: PatientImportStatus;
  createdAt: string;
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
export async function createPatientImport({
  cxId,
  facilityId: facilityIdParam,
  params = {},
}: PatientImportCreateCmd): Promise<PatientImportCreateResponse> {
  const { log } = out(
    `createPatientImport - cxId ${cxId}, facilityId ${facilityIdParam}, params ${JSON.stringify(
      params
    )}`
  );
  const {
    dryRun = false,
    rerunPdOnNewDemographics = false,
    triggerConsolidated = false,
    disableWebhooks = false,
  } = params;
  const initializedParams: JobRecordParams = {
    dryRun,
    rerunPdOnNewDemographics,
    triggerConsolidated,
    disableWebhooks,
  };
  const facility = await getOptionalFacilityOrFail(cxId, facilityIdParam);
  const facilityId = facility.id;

  const createdAt = buildDayjs().toISOString();
  const status: PatientImportStatus = "waiting";

  const createParams: CreateJobRecordParams = {
    cxId,
    facilityId,
    createdAt,
    status,
    params: initializedParams,
  };
  const { jobId, bucketName, key } = await createJobRecord(createParams);

  const uploadUrl = await createUploadUrl({ cxId, jobId, bucketName });

  log(`Initialized job ${jobId} for facility ${facility.id}, key ${key}`);

  const resp: PatientImportCreateResponse = {
    ...createParams,
    jobId,
    uploadUrl,
  };
  return resp;
}

async function createUploadUrl({
  cxId,
  jobId,
  bucketName,
}: {
  cxId: string;
  jobId: string;
  bucketName: string;
}) {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  // const s3BucketName = CoreConfig.getPatientImportBucket();
  const key = createFileKeyRaw(cxId, jobId);
  const metadata = getMetadata();
  const s3Url = await s3Utils.getPresignedUploadUrl({
    bucket: bucketName,
    key,
    durationSeconds: presignedUploadUrlDuration.asSeconds(),
    metadata,
  });
  return s3Url;
}

function getMetadata(): Record<string, string> {
  if (Config.isDev()) {
    // TODO 2330: Move this to core so we can point to it from here and lambda - single source of truth
    return { isDev: "true" };
  }
  return {};
}
