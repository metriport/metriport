import { RefreshEhrBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createCanvasClient } from "../../shared";

export async function refreshEhrBundle({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
}: RefreshEhrBundleParamsForClient): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId });
  await api.getBundleByResourceType({
    cxId,
    canvasPatientId: ehrPatientId,
    metriportPatientId,
    resourceType,
    useCachedBundle: false,
  });
}
