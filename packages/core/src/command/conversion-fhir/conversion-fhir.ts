import { Bundle } from "@medplum/fhirtypes";

export type ConversionFhirRequest = {
  patientId: string;
  payload: string;
  unusedSegments: string;
  invalidAccess: string;
  source: string;
};

export interface ConversionFhirHandler {
  convertToFhir(params: ConversionFhirRequest): Promise<Bundle>;
}

export function buildConversionFhirUrl(fhirConverterUrl: string): string {
  return `${fhirConverterUrl}/api/convert/cda/ccd.hbs`;
}
