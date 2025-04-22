import { PatientJobWithData } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import {
  createJobDataPayload,
  getLatestPatientJobByStatus,
} from "../../../../../command/job/patient/get";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { canvasResourceDiffJobType } from "../../shared";
import { FetchCanvasBundleResult } from "../bundle/fetch-bundle";
import { fetchCanvasMetriportOnlyBundle } from "../bundle/fetch-metriport-only-bundle";
import { GetCanvasResourceDiffParams } from "./get-resource-diff";

export type GetLatestCanvasResourceDiffParams = Omit<GetCanvasResourceDiffParams, "jobId">;

/**
 * Get the latest canvas resource diff workflow for a Canvas patient
 * with the metriport only bundle if completed
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @returns workflow and metriport only bundle if completed or undefined if no workflow is found
 */
export async function getLatestCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: GetLatestCanvasResourceDiffParams): Promise<
  PatientJobWithData<FetchCanvasBundleResult> | undefined
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
  const job = await getLatestPatientJobByStatus({
    cxId,
    patientId: metriportPatientId,
    jobType: canvasResourceDiffJobType,
    jobGroupId: canvasPatientId,
  });
  if (!job) return undefined;
  if (job.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      jobId: job.id,
    });
    return createJobDataPayload({ job, data });
  }
  return createJobDataPayload({ job });
}
