import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getLatestWorkflow } from "../../../../../command/workflow/get";
import { getCanvasResourceDiffWorkflowId } from "../../shared";
import { fetchCanvasMetriportOnlyBundle } from "../bundle/fetch-metriport-only-bundle";
import { GetCanvasResourceDiffResult } from "./get-resource-diff";

export type GetCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

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
}: GetCanvasResourceDiffParams): Promise<GetCanvasResourceDiffResult | undefined> {
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
  const workflow = await getLatestWorkflow({
    cxId,
    patientId: metriportPatientId,
    workflowId: getCanvasResourceDiffWorkflowId(canvasPatientId),
  });
  if (!workflow) return undefined;
  if (workflow.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      requestId: workflow.requestId,
    });
    return { workflow, data };
  }
  return { workflow, data: undefined };
}
