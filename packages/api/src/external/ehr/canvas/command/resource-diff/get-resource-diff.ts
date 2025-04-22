import { PatientJobWithData } from "@metriport/shared";
import {
  createJobDataPayload,
  getPatientJobByIdOrFail,
} from "../../../../../command/job/patient/get";
import { FetchCanvasBundleResult } from "../bundle/fetch-bundle";
import { fetchCanvasMetriportOnlyBundle } from "../bundle/fetch-metriport-only-bundle";

export type GetCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  jobId: string;
};

/**
 * Get the canvas resource diff workflow for a Canvas patient by requestId
 * with the metriport only bundle if completed
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @param jobId The job ID of the workflow
 * @returns workflow and metriport only bundle if completed
 * @throws 404 if no workflow is found
 */
export async function getCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  jobId,
}: GetCanvasResourceDiffParams): Promise<PatientJobWithData<FetchCanvasBundleResult>> {
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
