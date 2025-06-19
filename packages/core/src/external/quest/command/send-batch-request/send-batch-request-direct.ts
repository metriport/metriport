import { QuestSendBatchRequestHandler } from "./send-batch-request";

import { QuestSftpClient } from "../../client";
import { QuestDataMapper } from "../../data-mapper";
import { QuestBatchRequest } from "../../types";

export class QuestSendBatchRequestHandlerDirect implements QuestSendBatchRequestHandler {
  constructor(private readonly client: QuestSftpClient = new QuestSftpClient()) {}

  async sendBatchRequest(request: QuestBatchRequest): Promise<void> {
    const dataMapper = new QuestDataMapper();
    const requestData = await dataMapper.getBatchRequestData(request);
    await this.client.sendBatchRequest(requestData);
  }
}
