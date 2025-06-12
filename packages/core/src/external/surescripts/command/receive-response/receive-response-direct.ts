import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsFileIdentifier } from "../../types";

export class SurescriptsReceiveResponseHandlerDirect implements SurescriptsReceiveResponseHandler {
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async receiveResponse({
    transmissionId,
    populationOrPatientId,
  }: SurescriptsFileIdentifier): Promise<void> {
    const responseFile = await this.client.receiveResponse({
      transmissionId,
      populationOrPatientId,
    });
    if (responseFile) {
      console.log(
        "TODO: ENG-377 - parse response file into FHIR bundle and place in conversion bucket"
      );
    }
  }
}
