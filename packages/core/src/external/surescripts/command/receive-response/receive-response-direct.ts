import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsFileIdentifier } from "../../types";

// import { convertFlatFile } from "../../fhir-converter";

export class SurescriptsReceiveResponseHandlerDirect implements SurescriptsReceiveResponseHandler {
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async receiveResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<void> {
    const responseFile = await this.client.receiveResponse({ transmissionId, populationId });
    if (responseFile) {
      responseFile.content;
    }
  }
}
