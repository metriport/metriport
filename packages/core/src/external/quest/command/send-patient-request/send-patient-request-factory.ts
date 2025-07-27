import { Config } from "../../../../util/config";
import { QuestSendPatientRequestHandler } from "./send-patient-request";
import { QuestSendPatientRequestCloud } from "./send-patient-request-cloud";
import { QuestSendPatientRequestHandlerDirect } from "./send-patient-request-direct";

export function buildSendPatientRequestHandler(): QuestSendPatientRequestHandler {
  if (Config.isDev()) {
    return new QuestSendPatientRequestHandlerDirect();
  }
  const queueUrl = Config.getQuestSendPatientRequestQueueUrl();
  return new QuestSendPatientRequestCloud(queueUrl);
}
