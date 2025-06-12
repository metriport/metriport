import { Config } from "../../../../util/config";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsSendPatientRequestHandler } from "./send-patient-request";
import { SurescriptsSendPatientRequestHandlerDirect } from "./send-patient-request-direct";
import { SurescriptsSendPatientRequestCloud } from "./send-patient-request-cloud";

export function buildSendPatientRequestHandler(
  client?: SurescriptsSftpClient
): SurescriptsSendPatientRequestHandler {
  if (Config.isDev()) {
    return new SurescriptsSendPatientRequestHandlerDirect(client ?? new SurescriptsSftpClient());
  }
  return new SurescriptsSendPatientRequestCloud(Config.getSurescriptsSendPatientRequestQueueUrl());
}
