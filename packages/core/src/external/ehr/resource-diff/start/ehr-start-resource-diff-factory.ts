import { Config } from "../../../../util/config";
import { EhrStartResourceDiffHandler } from "./ehr-start-resource-diff";
import { EhrStartResourceDiffCloud } from "./ehr-start-resource-diff-cloud";
import { EhrStartResourceDiffLocal } from "./ehr-start-resource-diff-local";

export function buildEhrStartResourceDiffHandler(): EhrStartResourceDiffHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new EhrStartResourceDiffLocal(waitTimeAtTheEndInMillis);
  }
  const ehrStartResourceDiffQueueUrl = Config.getEhrStartResourceDiffQueueUrl();
  return new EhrStartResourceDiffCloud(ehrStartResourceDiffQueueUrl);
}
