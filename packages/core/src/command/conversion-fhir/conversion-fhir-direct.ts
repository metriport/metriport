import { Bundle } from "@medplum/fhirtypes";
import axios from "axios";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { TXT_MIME_TYPE } from "../../util/mime";
import { ConversionFhirHandler, ConversionFhirRequest } from "./conversion-fhir";
import { convertPayloadToFHIR } from "./shared";

const FHIR_CONVERSION_API_PATH = "/api/convert/cda/ccd.hbs";

function buildConversionFhirUrl(fhirConverterUrl: string): string {
  return `${fhirConverterUrl}${FHIR_CONVERSION_API_PATH}`;
}

export class ConversionFhirDirect implements ConversionFhirHandler {
  constructor(private readonly fhirConverterUrl: string) {}

  async convertToFhir(params: ConversionFhirRequest): Promise<{ bundle: Bundle }> {
    const fhirConverterUrl = this.fhirConverterUrl;
    async function convertToFhir(payload: string, params: FhirConverterParams): Promise<Bundle> {
      const url = buildConversionFhirUrl(fhirConverterUrl);
      const resp = await axios.post(url, payload, {
        params,
        headers: { "Content-Type": TXT_MIME_TYPE },
      });
      return resp.data.fhirResource as Bundle;
    }
    const bundle = await convertPayloadToFHIR({ convertToFhir, params });
    return { bundle };
  }
}
