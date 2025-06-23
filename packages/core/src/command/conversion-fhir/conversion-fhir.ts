import { Bundle } from "@medplum/fhirtypes";
import { FHIRConverterCDATemplate } from "@metriport/shared/domain/converison-fhir";

export type ConversionFhirRequest = {
  cxId: string;
  patientId: string;
  s3File?: {
    fileName: string;
    bucketName: string;
  };
  rawData?: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
};

export interface ConversionFhirHandler {
  convertToFhir(params: ConversionFhirRequest): Promise<Bundle>;
}
