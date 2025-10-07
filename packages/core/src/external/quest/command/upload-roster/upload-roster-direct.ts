import { QuestSftpClient } from "../../client";
import { QuestRosterType } from "../../types";
import { QuestUploadRosterHandler } from "./upload-roster";

export class QuestUploadRosterHandlerDirect implements QuestUploadRosterHandler {
  constructor(private readonly client = new QuestSftpClient()) {}

  async generateAndUploadLatestQuestRoster({
    rosterType,
  }: {
    rosterType: QuestRosterType;
  }): Promise<void> {
    await this.client.generateAndUploadRoster({ rosterType });
  }
}
