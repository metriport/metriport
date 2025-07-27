import { Config } from "../../../../util/config";
import { QuestReceiveResponseHandler } from "./receive-response";
import { QuestReceiveResponseHandlerCloud } from "./receive-response-cloud";
import { QuestReceiveResponseHandlerDirect } from "./receive-response-direct";

export function buildReceiveResponseHandler(): QuestReceiveResponseHandler {
  if (Config.isDev()) {
    return new QuestReceiveResponseHandlerDirect();
  }
  const queueUrl = Config.getQuestReceiveResponseQueueUrl();
  return new QuestReceiveResponseHandlerCloud(queueUrl);
}
