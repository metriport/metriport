import { QuestSftpClient } from "../../client";
import { QuestRosterRequest } from "../../types";
import { QuestUploadRosterHandler } from "./upload-roster";

export class QuestUploadRosterHandlerDirect implements QuestUploadRosterHandler {
  constructor(private readonly client = new QuestSftpClient()) {}

  async generateAndUploadLatestQuestRoster({ rosterType }: QuestRosterRequest): Promise<void> {
    await this.client.generateAndUploadRoster({ rosterType });
  }
}
