import { Config } from "../../../util/config";
import { EhrResourceDifftHandler } from "./ehr-resource-diff";
import { EhrResourceDiffCloud } from "./ehr-resource-diff-cloud";
import { EhrResourceDiffLocal } from "./ehr-resource-diff-local";

export function buildEhrResourceDiffHandler(): EhrResourceDifftHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrResourceDiffLocal(waitTimeAtTheEndInMillis);
  }
  const ehrResourceDiffQueueUrl = Config.getEhrResourceDiffQueueUrl();
  return new EhrResourceDiffCloud(ehrResourceDiffQueueUrl);
}
