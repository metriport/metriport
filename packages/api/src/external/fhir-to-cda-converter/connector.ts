import { Organization } from "@medplum/fhirtypes";
import { Bundle } from "../../routes/medical/schemas/fhir";

export type FhirToCdaConverterRequest = {
  cxId: string;
  patientId: string;
  bundle: Bundle;
  organization: Organization;
};

export interface FhirToCdaConverter {
  requestConvert(req: FhirToCdaConverterRequest): Promise<string[]>;
}