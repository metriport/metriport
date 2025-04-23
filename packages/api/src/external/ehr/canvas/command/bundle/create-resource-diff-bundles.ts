import { buildEhrStartResourceDiffBundlesHandler } from "@metriport/core/external/ehr/bundle/create-resource-diff-bundles/steps/start/ehr-start-resource-diff-bundles-factory";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { BadRequestError } from "../../../../../../../shared/dist";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type CreateResourceDiffBundlesParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
};

/**
 * Starts the resource diff workflow to produce the resource type bundles containing
 * the resources in Metriport that are not in Canvas, or vice versa.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 * @param direction - The direction of the resource diff bundles to create.
 */
export async function createResourceDiffBundles({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  direction,
}: CreateResourceDiffBundlesParams): Promise<void> {
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
  if (direction === ResourceDiffDirection.METRIPORT_ONLY) {
    const ehrResourceDiffHandler = buildEhrStartResourceDiffBundlesHandler();
    await ehrResourceDiffHandler.startResourceDiffBundlesMetriportOnly({
      ehr: EhrSources.canvas,
      cxId,
      practiceId: canvasPracticeId,
      metriportPatientId,
      ehrPatientId: canvasPatientId,
    });
  }
  throw new BadRequestError("Unsupported direction", undefined, {
    direction,
  });
}
