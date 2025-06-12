import { Config } from "../../../../util/config";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsSendBatchRequestHandler } from "./send-batch-request";
import { SurescriptsSendBatchRequestHandlerDirect } from "./send-batch-request-direct";
import { SurescriptsSendBatchRequestHandlerCloud } from "./send-batch-request-cloud";

export function buildSendBatchRequestHandler(
  client?: SurescriptsSftpClient
): SurescriptsSendBatchRequestHandler {
  if (Config.isDev()) {
    return new SurescriptsSendBatchRequestHandlerDirect(client ?? new SurescriptsSftpClient());
  }
  return new SurescriptsSendBatchRequestHandlerCloud(
    Config.getSurescriptsSendBatchRequestQueueUrl()
  );
}
