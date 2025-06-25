import { Config } from "../../util/config";
import { ConversionFhirHandler } from "./conversion-fhir";
import { ConversionFhirCloud } from "./conversion-fhir-cloud";
import { ConversionFhirDirect } from "./conversion-fhir-direct";

export function buildConversionFhirHandler(): ConversionFhirHandler {
  if (Config.isDev()) {
    return new ConversionFhirDirect();
  }
  return new ConversionFhirCloud();
}
