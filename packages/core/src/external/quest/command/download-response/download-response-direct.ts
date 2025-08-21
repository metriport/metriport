import { MetriportError } from "@metriport/shared";
import { QuestSftpClient } from "../../client";
import { QuestReplica } from "../../replica";
import { DownloadResponseCommandHandler } from "./download-response";
import { QuestCreateSourceDocumentsHandler } from "../create-source-documents/create-source-documents";
import { QuestCreateSourceDocumentsHandlerDirect } from "../create-source-documents/create-source-documents-direct";

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  private readonly next: QuestCreateSourceDocumentsHandler;

  constructor(private readonly client = new QuestSftpClient()) {
    this.next = new QuestCreateSourceDocumentsHandlerDirect(this.getQuestReplica());
  }

  async downloadAllQuestResponses(): Promise<void> {
    const responseFiles = await this.client.downloadAllResponses();
    await this.next.createSourceDocuments(responseFiles);
  }

  /**
   * This handler requires the Quest client to be correctly configured with a QuestReplica instance.
   */
  private getQuestReplica(): QuestReplica {
    const replica = this.client.getReplica();
    if (!replica || !(replica instanceof QuestReplica)) {
      throw new MetriportError("Quest replica is not correctly initialized", undefined, {
        context: "quest.command.download-response-direct",
      });
    }
    return replica;
  }
}
