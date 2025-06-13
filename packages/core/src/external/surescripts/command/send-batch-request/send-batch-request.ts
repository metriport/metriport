import { SurescriptsBatchRequest } from "../../types";

export interface SurescriptsSendBatchRequestHandler {
  sendBatchRequest(requestData: SurescriptsBatchRequest): Promise<void>;
}
