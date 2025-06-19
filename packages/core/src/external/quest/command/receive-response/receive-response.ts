import { QuestJob } from "../../types";

export interface QuestReceiveResponseHandler {
  receiveResponse(job: QuestJob): Promise<void>;
}
