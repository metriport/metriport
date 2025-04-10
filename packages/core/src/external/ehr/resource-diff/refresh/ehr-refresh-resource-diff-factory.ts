import { Config } from "../../../../util/config";
import { EhrRefreshResourceDiffHandler } from "./ehr-refresh-resource-diff";
import { EhrRefreshResourceDiffCloud } from "./ehr-refresh-resource-diff-cloud";
import { EhrRefreshResourceDiffLocal } from "./ehr-refresh-resource-diff-local";

export function buildEhrRefreshResourceDiffHandler(): EhrRefreshResourceDiffHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrRefreshResourceDiffLocal(waitTimeAtTheEndInMillis);
  }
  const ehrRefreshResourceDiffQueueUrl = Config.getEhrRefreshResourceDiffQueueUrl();
  return new EhrRefreshResourceDiffCloud(ehrRefreshResourceDiffQueueUrl);
}
