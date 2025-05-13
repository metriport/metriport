import { RefreshEhrBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createCanvasClient } from "../../shared";

export async function refreshEhrBundles({
  cxId,
  practiceId,
  patientId,
  metriportPatientId,
  resourceType,
}: RefreshEhrBundleParamsForClient): Promise<void> {
  const api = await createCanvasClient({ cxId, practiceId });
  await api.getBundleByResourceType({
    cxId,
    canvasPatientId: patientId,
    metriportPatientId,
    resourceType,
    useCachedBundle: false,
  });
}
