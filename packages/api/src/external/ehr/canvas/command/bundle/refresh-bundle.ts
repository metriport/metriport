import { buildEhrRefreshBundleHandler } from "@metriport/core/external/ehr/bundle/refresh/ehr-refresh-resource-bundle-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type RefreshBundleParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

/**
 * Refreshes the Canvas bundle for the patient in s3 across all supported resource types.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 */
export async function refreshCanvasBundle({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: RefreshBundleParams): Promise<void> {
  const ehrResourceDiffHandler = buildEhrRefreshBundleHandler();
  await ehrResourceDiffHandler.refreshBundle({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    patientId: canvasPatientId,
  });
}
