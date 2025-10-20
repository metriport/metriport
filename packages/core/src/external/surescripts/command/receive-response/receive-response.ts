import { SurescriptsJob } from "../../types";

export interface SurescriptsReceiveResponseHandler {
  receiveResponse(job: SurescriptsJob): Promise<void>;
}
