import axios from "axios";
import { Config } from "../../shared/config";
import { FHIRConverterConnector, FHIRConverterRequest } from "./connector";

export function buildUrl(url: string, sourceType: string, template: string): string {
  return `${url}/api/convert/${sourceType}/${template}`;
}

export class FHIRConverterConnectorHTTP implements FHIRConverterConnector {
  async requestConvert({
    patientId,
    sourceType,
    payload,
    template,
    unusedSegments,
    invalidAccess,
  }: FHIRConverterRequest): Promise<void> {
    const fhirConverterUrl = Config.getFHIRConverterServerURL();
    if (!fhirConverterUrl) {
      console.log(`FHIR_CONVERTER_SERVER_URL is not configured, skipping FHIR conversion...`);
      return;
    }
    const url = buildUrl(fhirConverterUrl, sourceType, template);

    const resp = await axios.post(url, payload, {
      params: {
        patientId,
        unusedSegments,
        invalidAccess,
      },
      headers: { "Content-Type": "text/plain" },
    });

    return resp.data.fhirResource;
  }
}
