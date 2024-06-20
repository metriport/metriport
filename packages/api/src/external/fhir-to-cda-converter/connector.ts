import { Bundle } from "../../routes/medical/schemas/fhir";

export type FhirToCdaConverterRequest = {
  cxId: string;
  toSplit: boolean;
  bundle: Bundle;
};

export interface FhirToCdaConverter {
  requestConvert(req: FhirToCdaConverterRequest): Promise<string[]>;
}
