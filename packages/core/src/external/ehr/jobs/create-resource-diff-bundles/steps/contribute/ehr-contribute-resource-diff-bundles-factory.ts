import { Config } from "../../../../../../util/config";
import { EhrContributeResourceDiffBundlesHandler } from "./ehr-contribute-resource-diff-bundles";
import { EhrContributeResourceDiffBundlesCloud } from "./ehr-contribute-resource-diff-bundles-cloud";
import { EhrContributeResourceDiffBundlesLocal } from "./ehr-contribute-resource-diff-bundles-local";

export function buildEhrContributeResourceDiffBundlesHandler(): EhrContributeResourceDiffBundlesHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrContributeResourceDiffBundlesLocal(waitTimeAtTheEndInMillis);
  }
  const ehrContributeDiffBundlesQueueUrl = Config.getEhrContributeDiffBundlesQueueUrl();
  return new EhrContributeResourceDiffBundlesCloud(ehrContributeDiffBundlesQueueUrl);
}
