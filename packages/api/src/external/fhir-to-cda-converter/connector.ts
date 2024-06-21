import { Bundle } from "../../routes/medical/schemas/fhir";

/**
 * @typeParam splitCompositions - boolean to indicate whether to split the bundle based on the Compositions
 * prior to FHIR-to-CDA conversion. Should be set to `false` for CCD generation.
 */
export type FhirToCdaConverterRequest = {
  cxId: string;
  splitCompositions: boolean;
  bundle: Bundle;
};

export interface FhirToCdaConverter {
  requestConvert(req: FhirToCdaConverterRequest): Promise<string[]>;
}
