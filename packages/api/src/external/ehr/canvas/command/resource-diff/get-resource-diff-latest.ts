import { Workflow } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getLatestWorkflow } from "../../../../../command/workflow/get";
import { getCanvasResourceDiffWorkflowId } from "../../shared";

export type GetCanvasResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
};

/**
 * Get the latest canvas resource diff workflow for a Canvas patient
 *
 * @param cxId
 * @param canvasPatientId
 * @returns workflow or undefined if no workflow is found
 */
export async function getLatestCanvasResourceDiff({
  cxId,
  canvasPatientId,
}: GetCanvasResourceDiffParams): Promise<Workflow | undefined> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const workflow = await getLatestWorkflow({
    cxId,
    patientId: metriportPatient.id,
    workflowId: getCanvasResourceDiffWorkflowId(canvasPatientId),
  });
  return workflow;
}
