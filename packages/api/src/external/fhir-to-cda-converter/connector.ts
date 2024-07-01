import { Bundle } from "../../routes/medical/schemas/fhir";

export type FhirToCdaConverterRequest = {
  cxId: string;
  /**
   * Indicates whether to split the bundle based on the Compositions
   * prior to FHIR-to-CDA conversion. Should be set to `false` for CCD generation.
   */
  splitCompositions: boolean;
  bundle: Bundle;
};

export interface FhirToCdaConverter {
  requestConvert(req: FhirToCdaConverterRequest): Promise<string[]>;
}
