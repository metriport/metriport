import { SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsReceiveResponseHandler {
  receiveResponse({ transmissionId, populationId }: SurescriptsFileIdentifier): Promise<void>;
}
