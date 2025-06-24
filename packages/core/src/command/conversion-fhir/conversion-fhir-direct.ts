import { Bundle, Resource } from "@medplum/fhirtypes";
import axios from "axios";
import { TXT_MIME_TYPE } from "../../util/mime";
import { ConversionFhirHandler, ConverterRequest } from "./conversion-fhir";
import { Config } from "../../util/config";

const FHIR_CONVERSION_API_PATH = "/api/convert/cda/ccd.hbs";

function buildConversionFhirUrl(fhirConverterUrl: string): string {
  return `${fhirConverterUrl}${FHIR_CONVERSION_API_PATH}`;
}

export class ConversionFhirDirect extends ConversionFhirHandler {
  constructor(private readonly fhirConverterUrl: string = Config.getFhirConvertServerURL()) {
    super();
  }

  async callConverter(params: ConverterRequest): Promise<Bundle<Resource>> {
    const url = buildConversionFhirUrl(this.fhirConverterUrl);
    const resp = await axios.post(url, params.payload, {
      params: params.params,
      headers: { "Content-Type": TXT_MIME_TYPE },
    });
    return resp.data.fhirResource as Bundle<Resource>;
  }
}
