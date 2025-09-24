import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  // We don't have the direct implementation here because it requires params that are not available
  // in the cloud environment. Keeping the factory for maintainability.
  return new FhirToCsvIncrementalCloud();
}
