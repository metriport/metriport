import { Config } from "../../../../../../util/config";
import { EhrComputeResourceDiffBundlesHandler } from "./ehr-compute-resource-diff-bundles";
import { EhrComputeResourceDiffBundlesCloud } from "./ehr-compute-resource-diff-bundles-cloud";
import { EhrComputeResourceDiffBundlesLocal } from "./ehr-compute-resource-diff-bundles-local";

export function buildEhrComputeResourceDiffBundlesHandler(): EhrComputeResourceDiffBundlesHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrComputeResourceDiffBundlesLocal(waitTimeAtTheEndInMillis);
  }
  const ehrComputeResourceDiffBundlesQueueUrl = Config.getEhrComputeResourceDiffBundlesQueueUrl();
  return new EhrComputeResourceDiffBundlesCloud(ehrComputeResourceDiffBundlesQueueUrl);
}
