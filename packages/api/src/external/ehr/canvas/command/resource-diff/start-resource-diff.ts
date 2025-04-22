import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/steps/start/ehr-start-resource-diff-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type StartCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

/**
 * Starts the resource diff workflow for the patient to produce
 * the bundle of resources in Metriport that are not in Canvas.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 */
export async function startCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: StartCanvasResourceDiffParams): Promise<void> {
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
  const ehrResourceDiffHandler = buildEhrStartResourceDiffHandler();
  await ehrResourceDiffHandler.startResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    metriportPatientId,
    ehrPatientId: canvasPatientId,
  });
}
