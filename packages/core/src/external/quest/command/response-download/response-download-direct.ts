import { ResponseDownloadCommand } from "./response-download";
import { QuestSftpClient } from "../../client";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";

export class ResponseDownloadDirect implements ResponseDownloadCommand {
  constructor(private readonly next: QuestFhirConverterCommand) {}

  async downloadAllQuestResponses(): Promise<void> {
    console.log("Downloading all Quest responses");
    const client = new QuestSftpClient();
    const responseFileNames = await client.downloadAllResponses();

    // Trigger the next step of the data pipeline for each downloaded response file
    for (const responseFileName of responseFileNames) {
      await this.next.convertQuestResponseToFhirBundles(responseFileName);
    }
  }
}
