import { QuestSftpClient } from "../../client";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { DownloadResponseCommandHandler } from "./download-response";

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly next: QuestFhirConverterCommand
  ) {}

  async downloadAllQuestResponses(): Promise<void> {
    const responseFiles = await this.client.downloadAllResponses();

    // Trigger the next step of the data pipeline for each downloaded response file
    for (const responseFile of responseFiles) {
      await this.next.convertQuestResponseToFhirBundles(responseFile.fileName);
    }
  }
}
