import { PatientJobWithData } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  createPatientJobDataPayload,
  getLatestPatientJob,
} from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { FetchCanvasBundlePreSignedUrlsResult } from "../../command/bundle/fetch-metriport-only-bundle";
import { fetchCanvasMetriportOnlyBundlePreSignedUrls } from "../../command/bundle/fetch-metriport-only-bundle";
import { canvasMetriportOnlyBundleJobType } from "../../shared";
import { GetMetriportOnlyBundleParams } from "./get-job-payload";

export type GetLatestMetriportOnlyBundleParams = Omit<GetMetriportOnlyBundleParams, "jobId">;

/**
 * Get the latest metriport only bundle job data payload for a Canvas patient
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @returns metriport only job data payload if completed or undefined if no job is found
 */
export async function getLatestMetriportOnlyBundleJobPayload({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: GetLatestMetriportOnlyBundleParams): Promise<
  PatientJobWithData<FetchCanvasBundlePreSignedUrlsResult> | undefined
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
    jobTypeId: canvasMetriportOnlyBundleJobType,
    jobGroupId: canvasPatientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundlePreSignedUrls({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId: job.id,
    });
    return createPatientJobDataPayload({ job, data });
  }
  return createPatientJobDataPayload({ job });
}
