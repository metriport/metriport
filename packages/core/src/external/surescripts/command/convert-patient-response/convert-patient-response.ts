import { SurescriptsConversionBundle, SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsConvertPatientResponseHandler {
  convertPatientResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle | undefined>;
}
