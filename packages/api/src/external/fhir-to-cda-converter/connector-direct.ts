import { convertFhirBundleToCda } from "@metriport/core/fhir-to-cda/fhir-to-cda";
import { FhirToCdaConverter, FhirToCdaConverterRequest } from "./connector";

export class FhirToCdaConverterDirect implements FhirToCdaConverter {
  async requestConvert({ bundle, orgOid }: FhirToCdaConverterRequest): Promise<string[]> {
    return convertFhirBundleToCda(bundle, orgOid);
  }
}
