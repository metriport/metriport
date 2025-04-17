import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/steps/start/ehr-start-resource-diff-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { getResourceDiffWorkflowId } from "../../shared";

export type StartCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

export async function startCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
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
  const requestId = uuidv7();
  const ehrResourceDiffHandler = buildEhrStartResourceDiffHandler();
  await ehrResourceDiffHandler.startResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    metriportPatientId,
    ehrPatientId: canvasPatientId,
    requestId,
    workflowId: getResourceDiffWorkflowId(),
  });
  return requestId;
}
