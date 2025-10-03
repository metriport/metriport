import { QuestSftpClient } from "../../client";
import { QuestUploadRosterHandler } from "./upload-roster";

export class QuestUploadRosterHandlerDirect implements QuestUploadRosterHandler {
  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly notifications?: boolean | undefined
  ) {}

  async generateAndUploadLatestQuestRoster(): Promise<void> {
    await this.client.generateAndUploadRoster({ notifications: this.notifications });
  }
}
