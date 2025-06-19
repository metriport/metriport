import { Config } from "../../../../util/config";
import { SurescriptsVerifyRequestInHistoryHandler } from "./verify-request-in-history";
import { SurescriptsVerifyRequestInHistoryHandlerCloud } from "./verify-request-in-history-cloud";
import { SurescriptsVerifyRequestInHistoryHandlerDirect } from "./verify-request-in-history-direct";

export function buildVerifyRequestInHistoryHandler(): SurescriptsVerifyRequestInHistoryHandler {
  if (Config.isDev()) {
    return new SurescriptsVerifyRequestInHistoryHandlerDirect();
  }
  const queueUrl = Config.getSurescriptsVerifyRequestInHistoryQueueUrl();
  return new SurescriptsVerifyRequestInHistoryHandlerCloud(queueUrl);
}
