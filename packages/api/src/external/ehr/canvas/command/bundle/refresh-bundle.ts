import { buildEhrRefreshBundleHandler } from "@metriport/core/external/ehr/bundle/refresh/ehr-refresh-resource-bundle-factory";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";

export type RefreshBundleParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
};

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
