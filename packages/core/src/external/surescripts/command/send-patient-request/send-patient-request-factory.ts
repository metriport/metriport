import { Config } from "../../../../util/config";
import { SurescriptsSendPatientRequestHandler } from "./send-patient-request";
import { SurescriptsSendPatientRequestCloud } from "./send-patient-request-cloud";
import { SurescriptsSendPatientRequestHandlerDirect } from "./send-patient-request-direct";

export function buildSendPatientRequestHandler(): SurescriptsSendPatientRequestHandler {
  if (Config.isDev()) {
    return new SurescriptsSendPatientRequestHandlerDirect();
  }
  const queueUrl = Config.getSurescriptsSendPatientRequestQueueUrl();
  return new SurescriptsSendPatientRequestCloud(queueUrl);
}
