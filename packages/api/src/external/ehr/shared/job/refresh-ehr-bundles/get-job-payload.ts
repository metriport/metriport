import {
  createPatientJobPayload,
  getLatestPatientJob,
  getPatientJobByIdOrFail,
} from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { fetchBundlePreSignedUrls } from "../../command/fetch-bundle-presignd-urls";
import {
  GetResourceDiffBundlesJobPayloadParams,
  ResourceDiffBundlesJobPayload,
  getCreateResourceDiffBundlesJobType,
} from "../../utils/job";

/**
 * Get the resource diff bundles job payload by jobId
 *
 * @param ehr - The EHR source.
 * @param cxId The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The EHR patient id of the patient.
 * @param jobId The job ID of the job
 * @param direction The direction of the resource diff bundle to fetch
 * @returns resource diff bundles job payload with data if completed
 * @throws NotFoundError if no job is found
 */
export async function getResourceDiffBundlesJobPayload({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  jobId,
  direction,
}: GetResourceDiffBundlesJobPayloadParams): Promise<ResourceDiffBundlesJobPayload> {
  const job = await getPatientJobByIdOrFail({ cxId, jobId });
  if (job.status === "completed") {
    const data = await fetchBundlePreSignedUrls({
      ehr,
      cxId,
      ehrPatientId,
      practiceId,
      jobId,
      direction,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}

/**
 * Get the latest resource diff bundles job data payload
 *
 * @param ehr - The EHR source.
 * @param cxId The CX ID of the patient
 * @param practiceId - The practice id of the EHR patient.
 * @param ehrPatientId - The EHR patient id of the patient.
 * @param direction The direction of the resource diff bundle to fetch
 * @returns resource diff bundles job data payload with data if completed or undefined if no job is found
 */
export async function getLatestResourceDiffBundlesJobPayload({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  direction,
}: Omit<GetResourceDiffBundlesJobPayloadParams, "jobId">): Promise<
  ResourceDiffBundlesJobPayload | undefined
> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  const metriportPatientId = existingPatient.patientId;
  const job = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateResourceDiffBundlesJobType(ehr, direction),
    jobGroupId: ehrPatientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchBundlePreSignedUrls({
      ehr,
      cxId,
      practiceId,
      ehrPatientId,
      jobId: job.id,
      direction,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}
