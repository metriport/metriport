import { QuestJob, QuestPatientRequest } from "../../types";

export interface QuestSendPatientRequestHandler {
  sendPatientRequest(requestData: QuestPatientRequest): Promise<QuestJob>;
}
