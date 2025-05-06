import {
  createPatientJobPayload,
  getLatestPatientJob,
  getPatientJobByIdOrFail,
} from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { fetchResourceDiffBundlesPreSignedUrls } from "../../command/fetch-bundle-presignd-urls";
import {
  GetResourceDiffBundlesJobPayloadParams,
  ResourceDiffBundlesJobPayload,
  getCreateResourceDiffBundlesJobType,
} from "../../utils/job";

/**
 * Get the resource diff bundles job payload by job id
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param patientId - The EHR patient id of the patient.
 * @param jobId - The job id of the job.
 * @param bundleType - The type of resource diff bundle to fetch.
 * @returns resource diff bundles job payload with data if completed
 * @throws NotFoundError if no job is found
 */
export async function getResourceDiffBundlesJobPayload({
  ehr,
  cxId,
  practiceId,
  patientId,
  jobId,
  bundleType,
}: GetResourceDiffBundlesJobPayloadParams): Promise<ResourceDiffBundlesJobPayload> {
  const job = await getPatientJobByIdOrFail({ cxId, jobId });
  if (job.status === "completed") {
    const data = await fetchResourceDiffBundlesPreSignedUrls({
      ehr,
      cxId,
      patientId,
      practiceId,
      bundleType,
      jobId,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}

/**
 * Get the latest resource diff bundles job data payload
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID of the patient.
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The EHR patient id of the patient.
 * @param bundleType - The type of resource diff bundle to fetch.
 * @returns resource diff bundles job data payload with data if completed or undefined if no job is found
 */
export async function getLatestResourceDiffBundlesJobPayload({
  ehr,
  cxId,
  practiceId,
  patientId,
  bundleType,
}: Omit<GetResourceDiffBundlesJobPayloadParams, "jobId">): Promise<
  ResourceDiffBundlesJobPayload | undefined
> {
  const patientMapping = await getPatientMappingOrFail({
    cxId,
    externalId: patientId,
    source: ehr,
  });
  const metriportPatientId = patientMapping.patientId;
  const job = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateResourceDiffBundlesJobType(ehr),
    jobGroupId: patientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchResourceDiffBundlesPreSignedUrls({
      ehr,
      cxId,
      practiceId,
      patientId,
      bundleType,
      jobId: job.id,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}
