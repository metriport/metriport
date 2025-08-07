import { SurescriptsPatientRequest } from "../../types";

export interface SurescriptsSendPatientRequestHandler {
  sendPatientRequest(requestData: SurescriptsPatientRequest): Promise<string | undefined>;
}
