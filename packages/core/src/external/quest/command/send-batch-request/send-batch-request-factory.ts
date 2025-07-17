import { Config } from "../../../../util/config";
import { QuestSendBatchRequestHandler } from "./send-batch-request";
import { QuestSendBatchRequestHandlerCloud } from "./send-batch-request-cloud";
import { QuestSendBatchRequestHandlerDirect } from "./send-batch-request-direct";

export function buildSendBatchRequestHandler(): QuestSendBatchRequestHandler {
  if (Config.isDev()) {
    return new QuestSendBatchRequestHandlerDirect();
  }
  const queueUrl = Config.getQuestSendBatchRequestQueueUrl();
  return new QuestSendBatchRequestHandlerCloud(queueUrl);
}
