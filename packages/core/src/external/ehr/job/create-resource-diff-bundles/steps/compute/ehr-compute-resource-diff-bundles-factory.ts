import { Config } from "../../../../../../util/config";
import { EhrComputeResourceDiffBundlesHandler } from "./ehr-compute-resource-diff-bundles";
import { EhrComputeResourceDiffBundlesCloud } from "./ehr-compute-resource-diff-bundles-cloud";
import { EhrComputeResourceDiffBundlesDirect } from "./ehr-compute-resource-diff-bundles-direct";

export function buildEhrComputeResourceDiffBundlesHandler(): EhrComputeResourceDiffBundlesHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrComputeResourceDiffBundlesDirect(waitTimeAtTheEndInMillis);
  }
  const ehrComputeResourceDiffBundlesQueueUrl = Config.getEhrComputeResourceDiffBundlesQueueUrl();
  return new EhrComputeResourceDiffBundlesCloud(ehrComputeResourceDiffBundlesQueueUrl);
}
