import { Bundle, Resource } from "@medplum/fhirtypes";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { convertPayloadToFHIR } from "./shared";

export type ConversionFhirRequest = {
  cxId: string;
  patientId: string;
  requestId?: string;
  inputS3Key: string;
  inputS3BucketName: string;
  keepUnusedSegments?: boolean;
  keepInvalidAccess?: boolean;
};

export type ConverterRequest = {
  payload: string;
  params: FhirConverterParams;
};

export abstract class ConversionFhirHandler {
  async convertToFhir(params: ConversionFhirRequest): Promise<{
    bundle: Bundle;
    resultKey: string;
    resultBucket: string;
  }> {
    return await convertPayloadToFHIR({
      convertToFhir: this.callConverter.bind(this),
      params,
    });
  }

  abstract callConverter(params: ConverterRequest): Promise<Bundle<Resource>>;
}
