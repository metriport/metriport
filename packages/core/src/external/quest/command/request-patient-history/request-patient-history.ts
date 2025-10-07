import { QuestPatientRequest } from "../../types";

export interface QuestRequestPatientHistoryHandler {
  requestPatientHistory(requestData: QuestPatientRequest): Promise<string | undefined>;
}
