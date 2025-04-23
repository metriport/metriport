import {} from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  createPatientJobPayload,
  getLatestPatientJob,
  getPatientJobByIdOrFail,
  PatientJobPayload,
} from "../../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../../command/medical/patient/get-patient";
import { getCreateCanvasResourceDiffBundlesJobType } from "../../../shared";
import {
  fetchCanvasResourceDiffBundlePreSignedUrls,
  FetchResourceDiffBundlePreSignedUrlsResult,
} from "../fetch-resource-diff-bundle-pre-signed-urls";

export type GetResourceDiffBundlesJobPayloadParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  jobId: string;
  direction: ResourceDiffDirection;
};

type ResourceDiffBundlesJobPayload = PatientJobPayload<FetchResourceDiffBundlePreSignedUrlsResult>;

/**
 * Get the resource diff bundles job data payload by jobId
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @param jobId The job ID of the job
 * @param direction The direction of the resource diff bundle to fetch
 * @returns resource diff bundles job data payload if completed
 * @throws 404 if no job is found
 */
export async function getResourceDiffBundlesJobPayload({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  jobId,
  direction,
}: GetResourceDiffBundlesJobPayloadParams): Promise<ResourceDiffBundlesJobPayload> {
  const job = await getPatientJobByIdOrFail({ cxId, jobId });
  if (job.status === "completed") {
    const data = await fetchCanvasResourceDiffBundlePreSignedUrls({
      cxId,
      canvasPatientId,
      canvasPracticeId,
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
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @param direction The direction of the resource diff bundle to fetch
 * @returns resource diff bundles job data payload if completed or undefined if no job is found
 */
export async function getLatestResourceDiffBundlesJobPayload({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  direction,
}: Omit<GetResourceDiffBundlesJobPayloadParams, "jobId">): Promise<
  ResourceDiffBundlesJobPayload | undefined
> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const metriportPatientId = metriportPatient.id;
  const job = await getLatestPatientJob({
    cxId,
    patientId: metriportPatientId,
    jobType: getCreateCanvasResourceDiffBundlesJobType(direction),
    jobGroupId: canvasPatientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchCanvasResourceDiffBundlePreSignedUrls({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId: job.id,
      direction,
    });
    return createPatientJobPayload({ job, data });
  }
  return createPatientJobPayload({ job });
}
