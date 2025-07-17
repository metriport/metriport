import { QuestBatchRequest, QuestJob } from "../../types";

export interface QuestSendBatchRequestHandler {
  // TODO: ENG-565 - Add Quest patient job scheduler and return void
  sendBatchRequest(requestData: QuestBatchRequest): Promise<QuestJob>;
}
