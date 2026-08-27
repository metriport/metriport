import { Config } from "../../../../util/config";
import { SurescriptsUploadRosterHandler } from "./upload-roster";
import { SurescriptsUploadRosterHandlerCloud } from "./upload-roster-cloud";
import { SurescriptsUploadRosterHandlerDirect } from "./upload-roster-direct";

export function buildSurescriptsUploadRosterHandler(): SurescriptsUploadRosterHandler {
  if (Config.isDev()) {
    return new SurescriptsUploadRosterHandlerDirect();
  }
  return new SurescriptsUploadRosterHandlerCloud();
}
