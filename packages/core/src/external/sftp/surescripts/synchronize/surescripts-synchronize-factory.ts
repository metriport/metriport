import { Config } from "../../../../util/config";
import { SurescriptsSynchronizeHandler } from "./surescripts-synchronize";
import { SurescriptsSynchronizeCloud } from "./surescripts-synchronize-cloud";
import { SurescriptsSynchronizeLocal } from "./surescripts-synchronize-local";

export function buildSurescriptsSynchronizeHandler(): SurescriptsSynchronizeHandler {
  if (Config.isDev()) {
    const waitTimeAtTheEndInMillis = 0;
    return new SurescriptsSynchronizeLocal(waitTimeAtTheEndInMillis);
  }
  const surescriptsSynchronizeLambdaName = Config.getSurescriptsSynchronizeLambdaName();
  return new SurescriptsSynchronizeCloud(surescriptsSynchronizeLambdaName);
}
