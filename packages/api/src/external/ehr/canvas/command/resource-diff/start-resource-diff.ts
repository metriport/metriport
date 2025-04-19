import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/steps/start/ehr-start-resource-diff-factory";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared/dist/error/bad-request";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createWorkflow } from "../../../../../command/workflow/create";
import { getLatestWorkflow } from "../../../../../command/workflow/get";
import { getCanvasResourceDiffWorkflowId } from "../../shared";

export type StartCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  requestId?: string | undefined;
};

/**
 * Starts the resource diff workflow for the patient that is in Canvas to produce
 * the Metriport only bundle.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 * @param requestId - The request id of the workflow.
 * @returns the request id of the workflow.
 * @throws 400 if the workflow is currently processing.
 */
export async function startCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  requestId: requestIdParam,
}: StartCanvasResourceDiffParams): Promise<string> {
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
  const requestId = requestIdParam ?? uuidv7();
  const workflowId = getCanvasResourceDiffWorkflowId(canvasPatientId);
  const latestWorkflow = await getLatestWorkflow({
    cxId,
    patientId: metriportPatientId,
    workflowId,
  });
  if (latestWorkflow && latestWorkflow.status === "processing") {
    throw new BadRequestError(`Workflow ${workflowId} is currently processing`, {
      cxId,
      metriportPatientId,
      workflowId,
      runningWorkflowId: latestWorkflow.id,
    });
  }
  await createWorkflow({
    cxId,
    patientId: metriportPatientId,
    workflowId,
    requestId,
  });
  const ehrResourceDiffHandler = buildEhrStartResourceDiffHandler();
  await ehrResourceDiffHandler.startResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    metriportPatientId,
    ehrPatientId: canvasPatientId,
    workflowId,
    requestId,
  });
  return requestId;
}
