import { SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsReceiveResponseHandler {
  receiveResponse({
    transmissionId,
    populationOrPatientId,
  }: SurescriptsFileIdentifier): Promise<void>;
}
