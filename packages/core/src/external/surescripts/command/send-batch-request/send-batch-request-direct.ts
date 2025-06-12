import { SurescriptsSendBatchRequestHandler } from "./send-batch-request";

import { SurescriptsSftpClient } from "../../client";
import { SurescriptsApi } from "../../api";
import { SurescriptsBatchRequest } from "../../types";

export class SurescriptsSendBatchRequestHandlerDirect
  implements SurescriptsSendBatchRequestHandler
{
  constructor(
    private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient({
      logLevel: "debug",
    })
  ) {}

  async sendBatchRequest(request: SurescriptsBatchRequest): Promise<void> {
    const api = new SurescriptsApi();
    const requestData = await api.getBatchRequestData(request);
    await this.client.sendBatchRequest(requestData);
  }
}
