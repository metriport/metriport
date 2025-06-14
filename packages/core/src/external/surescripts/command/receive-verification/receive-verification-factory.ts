import { Config } from "../../../../util/config";
import { SurescriptsReceiveVerificationHandler } from "./receive-verification";
import { SurescriptsReceiveVerificationHandlerCloud } from "./receive-verification-cloud";
import { SurescriptsReceiveVerificationHandlerDirect } from "./receive-verification-direct";

export function buildReceiveVerificationHandler(): SurescriptsReceiveVerificationHandler {
  if (Config.isDev()) {
    return new SurescriptsReceiveVerificationHandlerDirect();
  }
  const queueUrl = Config.getSurescriptsReceiveVerificationQueueUrl();
  return new SurescriptsReceiveVerificationHandlerCloud(queueUrl);
}
