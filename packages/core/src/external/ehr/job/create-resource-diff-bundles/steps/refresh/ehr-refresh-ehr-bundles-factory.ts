import { Config } from "../../../../../../util/config";
import { EhrRefreshEhrBundlesHandler } from "./ehr-refresh-ehr-bundles";
import { EhrRefreshEhrBundlesCloud } from "./ehr-refresh-ehr-bundles-cloud";
import { EhrRefreshEhrBundlesDirect } from "./ehr-refresh-ehr-bundles-direct";

export function buildEhrRefreshEhrBundlesHandler(): EhrRefreshEhrBundlesHandler {
  if (Config.isDev()) {
    return new EhrRefreshEhrBundlesDirect();
  }
  return new EhrRefreshEhrBundlesCloud();
}
