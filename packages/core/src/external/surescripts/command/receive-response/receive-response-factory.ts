import { Config } from "../../../../util/config";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsReceiveResponseHandlerDirect } from "./receive-response-direct";
import { SurescriptsReceiveResponseHandlerCloud } from "./receive-response-cloud";

export function buildReceiveResponseHandler(
  client?: SurescriptsSftpClient
): SurescriptsReceiveResponseHandler {
  if (Config.isDev()) {
    return new SurescriptsReceiveResponseHandlerDirect(client ?? new SurescriptsSftpClient());
  }
  return new SurescriptsReceiveResponseHandlerCloud(
    Config.getSurescriptsReceiveFlatFileResponseQueueUrl()
  );
}
