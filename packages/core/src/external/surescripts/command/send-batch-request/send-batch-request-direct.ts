import { SurescriptsSendBatchRequestHandler } from "./send-batch-request";

import { SurescriptsSftpClient } from "../../client";
import { SurescriptsDataMapper } from "../../data-mapper";
import { SurescriptsBatchRequest } from "../../types";

export class SurescriptsSendBatchRequestHandlerDirect
  implements SurescriptsSendBatchRequestHandler
{
  constructor(private readonly client: SurescriptsSftpClient = new SurescriptsSftpClient()) {}

  async sendBatchRequest(request: SurescriptsBatchRequest): Promise<void> {
    const dataMapper = new SurescriptsDataMapper();
    const requestData = await dataMapper.getBatchRequestData(request);
    await this.client.sendBatchRequest(requestData);
  }
}
