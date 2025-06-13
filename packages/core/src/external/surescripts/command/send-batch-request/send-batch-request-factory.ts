import { Config } from "../../../../util/config";
import { SurescriptsSendBatchRequestHandler } from "./send-batch-request";
import { SurescriptsSendBatchRequestHandlerCloud } from "./send-batch-request-cloud";
import { SurescriptsSendBatchRequestHandlerDirect } from "./send-batch-request-direct";

export function buildSendBatchRequestHandler(): SurescriptsSendBatchRequestHandler {
  if (Config.isDev()) {
    return new SurescriptsSendBatchRequestHandlerDirect();
  }
  const queueUrl = Config.getSurescriptsSendBatchRequestQueueUrl();
  return new SurescriptsSendBatchRequestHandlerCloud(queueUrl);
}
