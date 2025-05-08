import { Config } from "../../../../../../../util/config";
import { EhrStartResourceDiffBundlesHandler } from "./ehr-start-resource-diff-bundles";
import { EhrStartResourceDiffBundlesCloud } from "./ehr-start-resource-diff-bundles-cloud";
import { EhrStartResourceDiffBundlesLocal } from "./ehr-start-resource-diff-bundles-local";

export function buildEhrStartResourceDiffBundlesHandler(): EhrStartResourceDiffBundlesHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrStartResourceDiffBundlesLocal(waitTimeAtTheEndInMillis);
  }
  const ehrStartResourceDiffBundlesQueueUrl = Config.getEhrStartResourceDiffBundlesQueueUrl();
  return new EhrStartResourceDiffBundlesCloud(ehrStartResourceDiffBundlesQueueUrl);
}
