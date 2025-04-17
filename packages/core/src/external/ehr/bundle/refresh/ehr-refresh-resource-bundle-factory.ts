import { Config } from "../../../../util/config";
import { EhrRefreshBundleHandler } from "./ehr-refresh-resource-bundle";
import { EhrRefreshBundleCloud } from "./ehr-refresh-resource-bundle-cloud";
import { EhrRefreshBundleLocal } from "./ehr-refresh-resource-bundle-local";

export function buildEhrRefreshBundleHandler(): EhrRefreshBundleHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrRefreshBundleLocal(waitTimeAtTheEndInMillis);
  }
  const ehrRefreshBundleQueueUrl = Config.getEhrRefreshBundleQueueUrl();
  return new EhrRefreshBundleCloud(ehrRefreshBundleQueueUrl);
}
