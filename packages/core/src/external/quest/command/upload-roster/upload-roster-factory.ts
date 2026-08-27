import { Config } from "../../../../util/config";
import { QuestUploadRosterHandler } from "./upload-roster";
import { QuestUploadRosterHandlerCloud } from "./upload-roster-cloud";
import { QuestUploadRosterHandlerDirect } from "./upload-roster-direct";

export function buildQuestUploadRosterHandler(): QuestUploadRosterHandler {
  if (Config.isDev()) {
    return new QuestUploadRosterHandlerDirect();
  }
  return new QuestUploadRosterHandlerCloud();
}
