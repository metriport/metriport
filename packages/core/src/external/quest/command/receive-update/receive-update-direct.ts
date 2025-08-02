import { QuestSftpClient } from "../../client";
import { QuestConversionBundle } from "../../types";
import { QuestReceiveUpdateCommand } from "./receive-update";

export class QuestReceiveUpdateHandlerDirect implements QuestReceiveUpdateCommand {
  private readonly client: QuestSftpClient;

  constructor(client: QuestSftpClient = new QuestSftpClient()) {
    this.client = client;
  }

  async receiveAllUpdates(): Promise<QuestConversionBundle[]> {
    // return this.client.receiveAllUpdates();
    return [];
  }
}
