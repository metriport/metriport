import { Config } from "../../../../util/config";
import { QuestConvertPatientResponseHandler } from "./convert-patient-response";
import { QuestConvertPatientResponseHandlerCloud } from "./convert-patient-response-cloud";
import { QuestConvertPatientResponseHandlerDirect } from "./convert-patient-response-direct";

export function buildQuestConvertPatientResponseHandler(): QuestConvertPatientResponseHandler {
  if (Config.isDev()) {
    return new QuestConvertPatientResponseHandlerDirect();
  }
  return new QuestConvertPatientResponseHandlerCloud();
}
