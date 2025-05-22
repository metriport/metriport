import { FetchBundleParamsForClient } from "../../../shared/utils/bundle/types";
import { createCanvasClient } from "../../shared";

export async function fetchBundlePreSignedUrl({
  cxId,
  practiceId,
  ehrPatientId,
  metriportPatientId,
  resourceType,
  bundleType,
  jobId,
}: FetchBundleParamsForClient): Promise<string | undefined> {
  const api = await createCanvasClient({ cxId, practiceId });
  return api.getBundleByResourceTypePreSignedUrl({
    cxId,
    canvasPatientId: ehrPatientId,
    metriportPatientId,
    resourceType,
    bundleType,
    jobId,
  });
}
