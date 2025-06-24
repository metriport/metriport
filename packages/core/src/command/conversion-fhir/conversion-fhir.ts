import { Bundle } from "@medplum/fhirtypes";
import { FHIRConverterCDATemplate } from "@metriport/shared/domain/converison-fhir";

export type ConversionFhirRequest = {
  cxId: string;
  patientId: string;
  requestId?: string;
  inputS3Key: string;
  inputS3BucketName: string;
  outputS3Key: string;
  outputS3BucketName: string;
  template?: FHIRConverterCDATemplate;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
};

export interface ConversionFhirHandler {
  convertToFhir(params: ConversionFhirRequest): Promise<{
    bundle: Bundle;
  }>;
}
