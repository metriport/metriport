import { Bundle } from "@medplum/fhirtypes";
import axios from "axios";
import {
  buildConversionFhirUrl,
  ConversionFhirHandler,
  ConversionFhirRequest,
} from "./conversion-fhir";

export class ConversionFhirDirect implements ConversionFhirHandler {
  constructor(private readonly fhirConverterUrl: string) {}

  async convertToFhir(params: ConversionFhirRequest): Promise<Bundle> {
    const url = buildConversionFhirUrl(this.fhirConverterUrl);
    const data = [params.payload];

    const resp = await axios.post(url, data, {
      params: {
        patientId: params.patientId,
        unusedSegments: params.unusedSegments,
        invalidAccess: params.invalidAccess,
        source: params.source,
      },
      headers: { "Content-Type": "text/plain" },
    });

    return resp.data.fhirResource;
  }
}
