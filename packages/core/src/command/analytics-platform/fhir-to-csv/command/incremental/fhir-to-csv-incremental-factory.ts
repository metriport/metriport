import { Config } from "../../../../../util/config";
import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";
import { FhirToCsvIncrementalDirect } from "./fhir-to-csv-incremental-direct";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  if (Config.isDev()) {
    return new FhirToCsvIncrementalDirect();
  }
  return new FhirToCsvIncrementalCloud();
}
