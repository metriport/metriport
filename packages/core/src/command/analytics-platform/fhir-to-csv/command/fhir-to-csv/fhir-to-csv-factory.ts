import { Config } from "../../../../../util/config";
import { FhirToCsvHandler } from "./fhir-to-csv";
import { FhirToCsvCloud } from "./fhir-to-csv-cloud";
import { FhirToCsvDirect } from "./fhir-to-csv-direct";

export function buildFhirToCsvHandler(): FhirToCsvHandler {
  if (Config.isDev()) {
    return new FhirToCsvDirect();
  }
  return new FhirToCsvCloud();
}
