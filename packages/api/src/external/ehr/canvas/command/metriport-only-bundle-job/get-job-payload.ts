import { PatientJobWithData } from "@metriport/shared";
import {
  createJobDataPayload,
  getPatientJobByIdOrFail,
} from "../../../../../command/job/patient/get";
import { FetchCanvasBundleResult } from "../bundle/fetch-bundle";
import { fetchCanvasMetriportOnlyBundle } from "../bundle/fetch-metriport-only-bundle";

export type GetMetriportOnlyBundleParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  jobId: string;
};

/**
 * Get the metriport only job payload for a Canvas patient by requestId
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @param jobId The job ID of the job
 * @returns metriport only job data payload if completed
 * @throws 404 if no job is found
 */
export async function getMetriportOnlyBundleJobPayload({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  jobId,
}: GetMetriportOnlyBundleParams): Promise<PatientJobWithData<FetchCanvasBundleResult>> {
  const job = await getPatientJobByIdOrFail({ cxId, jobId });
  if (job.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId,
    });
    return createJobDataPayload({ job, data });
  }
  return createJobDataPayload({ job });
}
