import { createFileKeyRaw } from "@metriport/core/command/patient-import/patient-import-shared";
import { createJobRecord } from "@metriport/core/command/patient-import/record/create-job-record";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { buildDayjs } from "@metriport/shared/common/date";
import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/status";
import {
  metaToRecord,
  PatientImport,
  PatientImportParamsCx,
  PatientImportParamsOps,
  PatientImportUploadMetadata,
} from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientImportModel } from "../../../../models/medical/patient-import";
import { getOptionalFacilityOrFail } from "../../facility/get-facility";

dayjs.extend(duration);

const presignedUploadUrlDuration = dayjs.duration(10, "minutes");

export type PatientImportCreateCmd = {
  cxId: string;
  facilityId?: string | undefined;
  paramsCx?: Partial<PatientImportParamsCx>;
  paramsOps?: Partial<PatientImportParamsOps>;
};

export type PatientImportCreateResponse = PatientImport & {
  uploadUrl: string;
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
  paramsCx = {},
  paramsOps = {},
}: PatientImportCreateCmd): Promise<PatientImportCreateResponse> {
  const { log } = out(`createPatientImport - cxId ${cxId}, facilityId ${facilityIdParam}`);

  const facility = await getOptionalFacilityOrFail(cxId, facilityIdParam);
  const facilityId = facility.id;

  log(
    `Creating job w/ paramsCx ${JSON.stringify(paramsCx)}, paramsOps ${JSON.stringify(paramsOps)}`
  );

  const { dryRun: dryRunCx = false } = paramsCx;
  const initializedParamsCx: PatientImportParamsCx = {
    dryRun: dryRunCx,
  };

  const {
    rerunPdOnNewDemographics = false,
    triggerConsolidated = false,
    disableWebhooks = false,
  } = paramsOps;
  const initializedParamsOps: PatientImportParamsOps = {
    rerunPdOnNewDemographics,
    triggerConsolidated,
    disableWebhooks,
    ...(paramsOps?.dryRun ? { dryRun: paramsOps.dryRun } : {}),
  };

  const jobId = uuidv7();
  const status: PatientImportStatus = "waiting";
  const createdAt = buildDayjs().toDate();

  const jobToCreate: PatientImport = {
    id: jobId,
    cxId,
    facilityId,
    status,
    reason: undefined,
    createdAt,
    startedAt: undefined,
    finishedAt: undefined,
    total: undefined,
    successful: undefined,
    failed: undefined,
    paramsCx: initializedParamsCx,
    paramsOps: initializedParamsOps,
  };

  const [job, uploadUrl] = await Promise.all([
    storeAtDb(jobToCreate),
    createUploadUrl({ cxId, jobId }),
    createJobRecord(jobToCreate),
  ]);

  log(`Initialized job ${jobId} for facility ${facility.id}`);

  const resp: PatientImportCreateResponse = {
    ...job,
    uploadUrl,
  };
  return resp;
}

async function storeAtDb(jobCreate: PatientImport): Promise<PatientImport> {
  const newPatientImport = await PatientImportModel.create(jobCreate);
  return newPatientImport.dataValues;
}

async function createUploadUrl({ cxId, jobId }: { cxId: string; jobId: string }) {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const s3BucketName = Config.getPatientImportBucket();
  const key = createFileKeyRaw(cxId, jobId);
  const metadata = metaToRecord(getUploadMetadata());
  const s3Url = await s3Utils.getPresignedUploadUrl({
    bucket: s3BucketName,
    key,
    durationSeconds: presignedUploadUrlDuration.asSeconds(),
    metadata,
  });
  return s3Url;
}

function getUploadMetadata(): PatientImportUploadMetadata {
  if (Config.isDev()) return { isDev: true };
  return {};
}
