import { QuestSendBatchRequestHandler } from "./send-batch-request";

import { QuestSftpClient } from "../../client";
import { QuestDataMapper } from "../../data-mapper";
import { QuestBatchRequest, QuestJob } from "../../types";

export class QuestSendBatchRequestHandlerDirect implements QuestSendBatchRequestHandler {
  constructor(private readonly client: QuestSftpClient = new QuestSftpClient()) {}

  async sendBatchRequest(request: QuestBatchRequest): Promise<QuestJob> {
    const dataMapper = new QuestDataMapper();
    const requestData = await dataMapper.getBatchRequestData(request);
    // TODO: ENG-565 - Should return void and schedule a subsequent patient job
    return await this.client.sendBatchRequest(requestData);
  }
}
