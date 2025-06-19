import { QuestPatientRequest } from "../../types";

export interface QuestSendPatientRequestHandler {
  sendPatientRequest(requestData: QuestPatientRequest): Promise<void>;
}
