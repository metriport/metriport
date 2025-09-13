import { SurescriptsReceiveResponseHandler } from "./receive-response";
import { SurescriptsSftpClient } from "../../client";
import { SurescriptsJob } from "../../types";
import { buildConvertBatchResponseHandler } from "../convert-batch-response/convert-batch-response-factory";

export class SurescriptsReceiveResponseHandlerDirect implements SurescriptsReceiveResponseHandler {
  constructor(
    private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient(),
    private readonly next = buildConvertBatchResponseHandler()
  ) {}

  async receiveResponse(job: SurescriptsJob): Promise<void> {
    const responseFile = await this.client.receiveResponse(job);
    if (responseFile) {
      await this.next.convertBatchResponse(job);
    }
  }
}
