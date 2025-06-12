import { Config } from "../../../../util/config";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsReceiveVerificationHandler } from "./receive-verification";
import { SurescriptsReceiveVerificationHandlerDirect } from "./receive-verification-direct";
import { SurescriptsReceiveVerificationHandlerCloud } from "./receive-verification-cloud";

export function buildReceiveVerificationHandler(
  client?: SurescriptsSftpClient
): SurescriptsReceiveVerificationHandler {
  if (Config.isDev()) {
    return new SurescriptsReceiveVerificationHandlerDirect(client ?? new SurescriptsSftpClient());
  }
  return new SurescriptsReceiveVerificationHandlerCloud(
    Config.getSurescriptsReceiveVerificationQueueUrl()
  );
}
