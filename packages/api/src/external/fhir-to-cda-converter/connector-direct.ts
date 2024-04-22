import { convertToCdaAndUpload } from "@metriport/core/fhir-to-cda/convert";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

export class FhirToCdaConverterDirect implements FhirToCdaConverter {
  async requestConvert({
    cxId,
    patientId,
    bundle,
    organization,
  }: FhirToCdaConverterRequest): Promise<void> {
    await convertToCdaAndUpload({
      cxId,
      patientId,
      bundle: bundle,
      organization,
    });
  }
}
