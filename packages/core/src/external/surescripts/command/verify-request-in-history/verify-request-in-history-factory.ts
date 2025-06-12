import { Config } from "../../../../util/config";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsVerifyRequestInHistoryHandler } from "./verify-request-in-history";
import { SurescriptsVerifyRequestInHistoryHandlerDirect } from "./verify-request-in-history-direct";
import { SurescriptsVerifyRequestInHistoryHandlerCloud } from "./verify-request-in-history-cloud";

export function buildVerifyRequestInHistoryHandler(
  client?: SurescriptsSftpClient
): SurescriptsVerifyRequestInHistoryHandler {
  if (Config.isDev()) {
    return new SurescriptsVerifyRequestInHistoryHandlerDirect(
      client ?? new SurescriptsSftpClient()
    );
  }
  return new SurescriptsVerifyRequestInHistoryHandlerCloud(
    Config.getSurescriptsVerifyRequestInHistoryQueueUrl()
  );
}
