import { Config } from "../../../../util/config";
import { EhrComputeResourceDiffHandler } from "./ehr-compute-resource-diff";
import { EhrComputeResourceDiffCloud } from "./ehr-compute-resource-diff-cloud";
import { EhrComputeResourceDiffLocal } from "./ehr-compute-resource-diff-local";

export function buildEhrComputeResourceDiffHandler(): EhrComputeResourceDiffHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrComputeResourceDiffLocal(waitTimeAtTheEndInMillis);
  }
  const ehrComputeResourceDiffQueueUrl = Config.getEhrComputeResourceDiffQueueUrl();
  return new EhrComputeResourceDiffCloud(ehrComputeResourceDiffQueueUrl);
}
