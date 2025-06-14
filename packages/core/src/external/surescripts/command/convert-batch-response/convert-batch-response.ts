import { Bundle } from "@medplum/fhirtypes";
import { SurescriptsFileIdentifier } from "../../types";

export interface SurescriptsConvertBatchResponseHandler {
  convertBatchResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<Bundle[]>;
}
