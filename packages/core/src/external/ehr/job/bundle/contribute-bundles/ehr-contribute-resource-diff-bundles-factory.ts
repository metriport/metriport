import { Config } from "../../../../../util/config";
import { EhrContributeResourceDiffBundlesHandler } from "./ehr-contribute-resource-diff-bundles";
import { EhrContributeResourceDiffBundlesCloud } from "./ehr-contribute-resource-diff-bundles-cloud";
import { EhrContributeResourceDiffBundlesDirect } from "./ehr-contribute-resource-diff-bundles-direct";

export function buildEhrContributeResourceDiffBundlesHandler(): EhrContributeResourceDiffBundlesHandler {
  if (Config.isDev()) {
    return new EhrContributeResourceDiffBundlesDirect();
  }
  return new EhrContributeResourceDiffBundlesCloud();
}
