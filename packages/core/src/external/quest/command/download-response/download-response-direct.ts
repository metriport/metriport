import { QuestSftpClient } from "../../client";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { DownloadResponseCommandHandler } from "./download-response";

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly next: QuestFhirConverterCommand
  ) {}

  async downloadAllQuestResponses(): Promise<void> {
    const responseFileNames = await this.client.downloadAllResponses();

    // Trigger the next step of the data pipeline for each downloaded response file
    for (const responseFileName of responseFileNames) {
      await this.next.convertQuestResponseToFhirBundles(responseFileName);
    }
  }
}
