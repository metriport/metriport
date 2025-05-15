import { FetchBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createAthenaClient } from "../../shared";

export async function fetchBundlePreSignedUrl({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
  bundleType,
  jobId,
}: FetchBundleParamsForClient): Promise<string | undefined> {
  const api = await createAthenaClient({ cxId, practiceId });
  return api.getBundleByResourceTypePreSignedUrl({
    cxId,
    athenaPatientId: ehrPatientId,
    metriportPatientId,
    resourceType,
    bundleType,
    jobId,
  });
}
