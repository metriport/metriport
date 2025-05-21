import { Config } from "../../../../util/config";
import { EhrGetBundleByResourceTypeHandler } from "./ehr-get-bundle-by-resource-type";
import { EhrGetBundleByResourceTypeCloud } from "./ehr-get-bundle-by-resource-type-cloud";
import { EhrGetBundleByResourceTypeLocal } from "./ehr-get-bundle-by-resource-type-local";

export function buildEhrGetBundleByResourceTypeHandler(): EhrGetBundleByResourceTypeHandler {
  if (Config.isDev()) {
    return new EhrGetBundleByResourceTypeLocal();
  }
  const ehrGetBundleByResourceTypeLambdaName = Config.getEhrGetBundleByResourceTypeLambdaName();
  return new EhrGetBundleByResourceTypeCloud(ehrGetBundleByResourceTypeLambdaName);
}
