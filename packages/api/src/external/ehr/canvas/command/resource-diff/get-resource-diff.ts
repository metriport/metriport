import { Workflow } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getWorkflowOrFail } from "../../../../../command/workflow/get";
import { getCanvasResourceDiffWorkflowId } from "../../shared";
import { FetchCanvasBundleResult } from "../bundle/fetch-bundle";
import { fetchCanvasMetriportOnlyBundle } from "../bundle/fetch-metriport-only-bundle";

export type GetCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  requestId: string;
};

export type GetCanvasResourceDiffResult = {
  workflow: Workflow;
  data: FetchCanvasBundleResult | undefined;
};

/**
 * Get the canvas resource diff workflow for a Canvas patient by requestId
 * with the metriport only bundle if completed
 *
 * @param cxId The CX ID of the patient
 * @param canvasPracticeId The Canvas practice ID
 * @param canvasPatientId The Canvas patient ID
 * @param requestId The request ID of the workflow
 * @returns workflow and metriport only bundle if completed
 * @throws 404 if no workflow is found
 */
export async function getCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  requestId,
}: GetCanvasResourceDiffParams): Promise<GetCanvasResourceDiffResult> {
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
  const workflow = await getWorkflowOrFail({
    cxId,
    patientId: metriportPatientId,
    workflowId: getCanvasResourceDiffWorkflowId(canvasPatientId),
    requestId,
  });
  if (workflow.status === "completed") {
    const data = await fetchCanvasMetriportOnlyBundle({
      cxId,
      canvasPatientId,
      canvasPracticeId,
      requestId,
    });
    return { workflow, data };
  }
  return { workflow, data: undefined };
}
