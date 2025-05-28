import { PatientJob } from "../../../../../../../../shared/dist";
import {
  createPatientJobPayload,
  getLatestPatientJob,
  getPatientJobByIdOrFail,
} from "../../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { fetchBundlePreSignedUrls } from "../../../command/bundle/fetch-bundle-presignd-urls";
import {
  GetResourceDiffBundlesJobPayloadParams,
  ResourceDiffBundlesJobPayload,
  getCreateResourceDiffBundlesJobType,
} from "../../../utils/job";

/**
 * Get the resource diff bundles job payload by job id
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param jobId - The job id of the job.
 * @param bundleType - The type of resource diff bundle to fetch.
 * @returns resource diff bundles job payload with data if completed
 * @throws NotFoundError if no job is found
 */
export async function getResourceDiffBundlesJobPayload(
  params: GetResourceDiffBundlesJobPayloadParams
): Promise<ResourceDiffBundlesJobPayload> {
  const { cxId, jobId } = params;
  const job = await getPatientJobByIdOrFail({ cxId, jobId });
  return getResourceDiffBundlesJobPayloadInternal({ ...params, job });
}

/**
 * Get the latest resource diff bundles job data payload
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param ehrPatientId - The patient id of the EHR patient.
 * @param bundleType - The type of resource diff bundle to fetch.
 * @returns resource diff bundles job data payload with data if completed or undefined if no job is found
 */
export async function getLatestResourceDiffBundlesJobPayload({
  ehr,
  cxId,
  ehrPatientId,
  bundleType,
}: Omit<GetResourceDiffBundlesJobPayloadParams, "jobId">): Promise<
  ResourceDiffBundlesJobPayload | undefined
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  const job = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateResourceDiffBundlesJobType(ehr),
    jobGroupId: ehrPatientId,
  });
  if (!job) return undefined;
  return getResourceDiffBundlesJobPayloadInternal({
    ehr,
    cxId,
    ehrPatientId,
    bundleType,
    job,
  });
}

async function getResourceDiffBundlesJobPayloadInternal({
  ehr,
  cxId,
  ehrPatientId,
  bundleType,
  job,
}: Omit<GetResourceDiffBundlesJobPayloadParams, "jobId"> & {
  job: PatientJob;
}): Promise<ResourceDiffBundlesJobPayload> {
  if (job.status === "completed") {
    const data = await fetchBundlePreSignedUrls({
      ehr,
      cxId,
      ehrPatientId,
      bundleType,
      jobId: job.id,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}
