import { SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsConvertPatientResponseHandler {
  convertPatientResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<void>;
}
