import { QuestSftpClient } from "../../client";
import { QuestSendRosterCommand } from "./send-roster";

export class QuestSendRosterHandlerDirect implements QuestSendRosterCommand {
  private readonly client: QuestSftpClient;

  constructor(client: QuestSftpClient = new QuestSftpClient()) {
    this.client = client;
  }

  async sendRoster(): Promise<{ size: number }> {
    // return this.client.sendRoster();
    return { size: 0 };
  }
}
