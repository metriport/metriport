import { QuestRosterType } from "../../types";
export interface QuestUploadRosterHandler {
  generateAndUploadLatestQuestRoster({
    rosterType,
  }: {
    rosterType: QuestRosterType;
  }): Promise<void>;
}
