import { buildEhrRefreshResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/refresh/ehr-refresh-resource-diff-factory";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type RefreshResourcesParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
};

export async function refreshCanvasResources({
  cxId,
  canvasPracticeId,
  canvasPatientId,
}: RefreshResourcesParams): Promise<void> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const ehrResourceDiffHandler = buildEhrRefreshResourceDiffHandler();
  await ehrResourceDiffHandler.refreshResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    patientId: canvasPatientId,
  });
}
