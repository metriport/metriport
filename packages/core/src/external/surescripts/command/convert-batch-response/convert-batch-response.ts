import { SurescriptsConversionBundle, SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsConvertBatchResponseHandler {
  convertBatchResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle[]>;
}
