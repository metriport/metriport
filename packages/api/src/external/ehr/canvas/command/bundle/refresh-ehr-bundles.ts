import { buildEhrRefreshEhrBundlesHandler } from "@metriport/core/external/ehr/bundle/refresh-ehr-bundles/ehr-refresh-ehr-bundles-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type RefreshCanvasBundlesParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

/**
 * Refreshes the cached bundles of resources that are in Canvas by iterating over all supported
 * resource types and fetching the Canvas data from Canvas for each resource type.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 */
export async function refreshCanvasBundles({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: RefreshCanvasBundlesParams): Promise<void> {
  const ehrResourceDiffHandler = buildEhrRefreshEhrBundlesHandler();
  await ehrResourceDiffHandler.refreshEhrBundles({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    patientId: canvasPatientId,
  });
}
