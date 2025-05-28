import { Config } from "../../../../util/config";
import { EhrGetBundleByResourceTypeHandler } from "./ehr-get-bundle-by-resource-type";
import { EhrGetBundleByResourceTypeCloud } from "./ehr-get-bundle-by-resource-type-cloud";
import { EhrGetBundleByResourceTypeDirect } from "./ehr-get-bundle-by-resource-type-direct";

export function buildEhrGetBundleByResourceTypeHandler(): EhrGetBundleByResourceTypeHandler {
  if (Config.isDev()) {
    return new EhrGetBundleByResourceTypeDirect();
  }
  const ehrGetBundleByResourceTypeLambdaName = Config.getEhrGetBundleByResourceTypeLambdaName();
  return new EhrGetBundleByResourceTypeCloud(ehrGetBundleByResourceTypeLambdaName);
}
