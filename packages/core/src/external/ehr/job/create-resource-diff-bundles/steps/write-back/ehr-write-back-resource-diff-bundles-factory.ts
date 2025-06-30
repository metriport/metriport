import { Config } from "../../../../../../util/config";
import { EhrWriteBackResourceDiffBundlesHandler } from "./ehr-write-back-resource-diff-bundles";
import { EhrWriteBackResourceDiffBundlesCloud } from "./ehr-write-back-resource-diff-bundles-cloud";
import { EhrWriteBackResourceDiffBundlesDirect } from "./ehr-write-back-resource-diff-bundles-direct";

export function buildEhrWriteBackResourceDiffBundlesHandler(): EhrWriteBackResourceDiffBundlesHandler {
  if (Config.isDev()) {
    return new EhrWriteBackResourceDiffBundlesDirect();
  }
  return new EhrWriteBackResourceDiffBundlesCloud();
}
