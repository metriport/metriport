import { createFileKeyRaw } from "@metriport/core/command/patient-import/patient-import-shared";
import { createJobRecord } from "@metriport/core/command/patient-import/record/create-job-record";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { out } from "@metriport/core/util/log";
import { createPatientImport as createDomain } from "@metriport/shared/domain/patient/patient-import/create";
import {
  PatientImportUploadMetadata,
  toS3Metadata,
} from "@metriport/shared/domain/patient/patient-import/metadata";
import {
  PatientImportJob,
  PatientImportParamsCx,
  PatientImportParamsOps,
} from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientImportJobModel } from "../../../../models/medical/patient-import";
import { getOptionalFacilityOrFail } from "../../facility/get-facility";

dayjs.extend(duration);

const presignedUploadUrlDuration = dayjs.duration(10, "minutes");

export type PatientImportJobCreateCmd = {
  cxId: string;
  facilityId?: string | undefined;
  paramsCx?: Partial<PatientImportParamsCx>;
  paramsOps?: Partial<PatientImportParamsOps>;
};

export type PatientImportJobCreateResponse = PatientImportJob & {
  uploadUrl: string;
};

/**
 * Initializes a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param facilityId - The facility ID (optional).
 * @param paramsCx - The customer-specific parameters (optional).
 * @param paramsOps - The operations-specific parameters (optional).
 * @returns the bulk import job with the URL to upload the CSV file.
 * @throws BadRequestError if no facility ID is provided and there's more than one facility for the customer.
 */
export async function createPatientImportJob({
  cxId,
  facilityId: facilityIdParam,
  paramsCx,
  paramsOps,
}: PatientImportJobCreateCmd): Promise<PatientImportJobCreateResponse> {
  const { log } = out(`createPatientImport - cxId ${cxId}, facilityId ${facilityIdParam}`);

  const facility = await getOptionalFacilityOrFail(cxId, facilityIdParam);
  const facilityId = facility.id;

  log(
    `Creating job w/ paramsCx ${JSON.stringify(paramsCx)}, paramsOps ${JSON.stringify(paramsOps)}`
  );

  const jobToCreate = createDomain({ cxId, facilityId, paramsCx, paramsOps });
  const jobId = jobToCreate.id;

  const [job, uploadUrl] = await Promise.all([
    storeAtDb(jobToCreate),
    createUploadUrl({ cxId, jobId }),
    createJobRecord(jobToCreate),
  ]);

  log(`Initialized job ${jobId} for facility ${facility.id}`);

  const resp: PatientImportJobCreateResponse = {
    ...job,
    uploadUrl,
  };
  return resp;
}

async function storeAtDb(jobCreate: PatientImportJob): Promise<PatientImportJob> {
  const newPatientImport = await PatientImportJobModel.create(jobCreate);
  return newPatientImport.dataValues;
}

async function createUploadUrl({ cxId, jobId }: { cxId: string; jobId: string }) {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const bucketName = Config.getPatientImportBucket();
  const key = createFileKeyRaw(cxId, jobId);
  const metadata = toS3Metadata(getUploadMetadata());
  const s3Url = await s3Utils.getPresignedUploadUrl({
    bucket: bucketName,
    key,
    durationSeconds: Math.round(presignedUploadUrlDuration.asSeconds()),
    metadata,
  });
  return s3Url;
}

function getUploadMetadata(): PatientImportUploadMetadata {
  if (Config.isDev()) return { isDev: true };
  return {};
}
