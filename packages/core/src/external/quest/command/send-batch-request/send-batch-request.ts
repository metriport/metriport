import { QuestBatchRequest } from "../../types";

export interface QuestSendBatchRequestHandler {
  sendBatchRequest(requestData: QuestBatchRequest): Promise<void>;
}
