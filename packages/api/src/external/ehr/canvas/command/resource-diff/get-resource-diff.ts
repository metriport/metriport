import { Workflow } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getWorkflowOrFail } from "../../../../../command/workflow/get";
import { getCanvasResourceDiffWorkflowId } from "../../shared";

export type GetCanvasResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  requestId: string;
};

/**
 * Get the canvas resource diff workflow for a Canvas patient by requestId
 *
 * @param cxId
 * @param canvasPatientId
 * @param requestId
 * @returns workflow
 * @throws 404 if no workflow is found
 */
export async function getCanvasResourceDiff({
  cxId,
  canvasPatientId,
  requestId,
}: GetCanvasResourceDiffParams): Promise<Workflow> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const workflow = await getWorkflowOrFail({
    cxId,
    patientId: metriportPatient.id,
    workflowId: getCanvasResourceDiffWorkflowId(canvasPatientId),
    requestId,
  });
  return workflow;
}
