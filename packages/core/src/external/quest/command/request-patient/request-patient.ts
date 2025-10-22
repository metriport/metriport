import { QuestPatientRequest, QuestPatientStatus } from "../../types";

export interface QuestRequestPatientHandler {
  requestPatient(requestData: QuestPatientRequest): Promise<QuestPatientStatus>;
}
