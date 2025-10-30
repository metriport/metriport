import { Config } from "../../../../util/config";
import { SurescriptsReceiveAllHandlerCloud } from "./receive-all-cloud";
import { SurescriptsReceiveAllHandlerDirect } from "./receive-all-direct";
import { SurescriptsReceiveAllHandler } from "./receive-all";

export function buildReceiveAllHandler(): SurescriptsReceiveAllHandler {
  if (Config.isDev()) {
    return new SurescriptsReceiveAllHandlerDirect();
  }
  return new SurescriptsReceiveAllHandlerCloud(Config.getSurescriptsReceiveAllLambdaName());
}
