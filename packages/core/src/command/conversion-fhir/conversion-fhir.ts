import { Bundle } from "@medplum/fhirtypes";

export type ConversionFhirRequest = {
  cxId: string;
  patientId: string;
  requestId?: string;
  inputS3Key: string;
  inputS3BucketName: string;
  outputS3Key: string;
  outputS3BucketName: string;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
};

export interface ConversionFhirHandler {
  convertToFhir(params: ConversionFhirRequest): Promise<{
    bundle: Bundle;
  }>;
}
