import { Config } from "../../../../../util/config";
import { FhirToCsvBulkHandler } from "./fhir-to-csv-bulk";
import { FhirToCsvBulkCloud } from "./fhir-to-csv-bulk-cloud";
import { FhirToCsvBulkDirect } from "./fhir-to-csv-bulk-direct";

export function buildFhirToCsvBulkHandler(): FhirToCsvBulkHandler {
  if (Config.isDev()) {
    return new FhirToCsvBulkDirect();
  }
  return new FhirToCsvBulkCloud();
}
