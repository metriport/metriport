import { Config } from "../../../../util/config";
import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsReceiveResponseHandlerCloud } from "./receive-response-cloud";
import { SurescriptsReceiveResponseHandlerDirect } from "./receive-response-direct";

export function buildReceiveResponseHandler(): SurescriptsReceiveResponseHandler {
  if (Config.isDev()) {
    return new SurescriptsReceiveResponseHandlerDirect();
  }
  const queueUrl = Config.getSurescriptsReceiveResponseQueueUrl();
  return new SurescriptsReceiveResponseHandlerCloud(queueUrl);
}
