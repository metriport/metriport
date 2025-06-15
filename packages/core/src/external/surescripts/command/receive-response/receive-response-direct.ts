import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsFileIdentifier } from "../../types";
import { buildConvertBatchResponseHandler } from "../convert-batch-response/convert-batch-response-factory";

export class SurescriptsReceiveResponseHandlerDirect implements SurescriptsReceiveResponseHandler {
  constructor(
    private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient(),
    private readonly convertBatchResponseHandler = buildConvertBatchResponseHandler()
  ) {}

  async receiveResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<void> {
    const responseFile = await this.client.receiveResponse({ transmissionId, populationId });
    if (responseFile) {
      await this.convertBatchResponseHandler.convertBatchResponse({
        transmissionId,
        populationId,
      });
    }
  }
}
