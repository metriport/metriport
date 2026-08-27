import { Bundle, Resource } from "@medplum/fhirtypes";
import axios from "axios";
import { FhirConverterParams } from "../../domain/conversion/bundle-modifications/modifications";
import { Config } from "../../util/config";
import { TXT_MIME_TYPE } from "../../util/mime";
import { ConversionFhirHandler } from "./conversion-fhir";

const FHIR_CONVERSION_API_PATH = "/api/convert/cda/ccd.hbs";

function buildConversionFhirUrl(fhirConverterUrl: string): string {
  return `${fhirConverterUrl}${FHIR_CONVERSION_API_PATH}`;
}

/**
 * Direct HTTP-based FHIR converter for local development.
 * Posts payload directly to the converter server.
 */
export class ConversionFhirDirect extends ConversionFhirHandler {
  constructor(private readonly fhirConverterUrl: string = Config.getFhirConvertServerURL()) {
    super();
  }

  async callConverter(params: FhirConverterParams, payload: string): Promise<Bundle<Resource>> {
    const url = buildConversionFhirUrl(this.fhirConverterUrl);
    const resp = await axios.post(url, payload, {
      params,
      headers: { "Content-Type": TXT_MIME_TYPE },
    });
    return resp.data.fhirResource as Bundle<Resource>;
  }
}
