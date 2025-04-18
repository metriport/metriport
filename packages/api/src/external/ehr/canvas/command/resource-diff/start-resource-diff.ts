import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/steps/start/ehr-start-resource-diff-factory";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createWorkflow } from "../../../../../command/workflow/create";
import { canvasResourceDiffWorkflowId } from "../../shared";

export type StartCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  requestId?: string | undefined;
};

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
  const workflowId = canvasResourceDiffWorkflowId;
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
