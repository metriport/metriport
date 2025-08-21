import { QuestSftpClient } from "../../client";
import { DownloadResponseCommandHandler } from "./download-response";
import { QuestCreateSourceDocumentsHandler } from "../create-source-documents/create-source-documents";
import { QuestCreateSourceDocumentsHandlerDirect } from "../create-source-documents/create-source-documents-direct";

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  private readonly next: QuestCreateSourceDocumentsHandler;

  constructor(private readonly client = new QuestSftpClient()) {
    this.next = new QuestCreateSourceDocumentsHandlerDirect();
  }

  async downloadAllQuestResponses(): Promise<void> {
    const responseFiles = await this.client.downloadAllResponses();
    await this.next.createSourceDocuments(responseFiles);
  }
}
