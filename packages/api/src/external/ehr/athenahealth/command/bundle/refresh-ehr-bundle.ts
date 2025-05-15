import { RefreshEhrBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createAthenaClient } from "../../shared";

export async function refreshEhrBundle({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
}: RefreshEhrBundleParamsForClient): Promise<void> {
  const api = await createAthenaClient({ cxId, practiceId });
  await api.getBundleByResourceType({
    cxId,
    athenaPatientId: ehrPatientId,
    metriportPatientId,
    resourceType,
    useCachedBundle: false,
  });
}
