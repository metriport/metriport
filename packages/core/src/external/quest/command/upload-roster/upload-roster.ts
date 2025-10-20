import { QuestRosterRequest } from "../../types";
export interface QuestUploadRosterHandler {
  generateAndUploadLatestQuestRoster({ rosterType }: QuestRosterRequest): Promise<void>;
}
