import { Config } from "../../../../../../util/config";
import { EhrRefreshEhrBundlesHandler } from "./ehr-refresh-ehr-bundles";
import { EhrRefreshEhrBundlesCloud } from "./ehr-refresh-ehr-bundles-cloud";
import { EhrRefreshEhrBundlesLocal } from "./ehr-refresh-ehr-bundles-local";

export function buildEhrRefreshEhrBundlesHandler(): EhrRefreshEhrBundlesHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrRefreshEhrBundlesLocal(waitTimeAtTheEndInMillis);
  }
  const ehrRefreshEhrBundlesQueueUrl = Config.getEhrRefreshEhrBundlesQueueUrl();
  return new EhrRefreshEhrBundlesCloud(ehrRefreshEhrBundlesQueueUrl);
}
