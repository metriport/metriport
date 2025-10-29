import { SurescriptsSftpClient } from "../../client";
import { SurescriptsDownloadResponsesHandler } from "./download-responses";

export class SurescriptsDownloadResponsesHandlerDirect
  implements SurescriptsDownloadResponsesHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async downloadResponses(): Promise<void> {
    const responses = await this.client.receiveAllNewResponses();
    console.log(`Downloaded ${responses.length} new responses`);
  }
}
