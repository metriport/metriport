import { Config } from "../../../../../util/config";
import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";
import { FhirToCsvIncrementalDirect } from "./fhir-to-csv-incremental-direct";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  if (Config.isDev()) {
    const analyticsBucketName = Config.getAnalyticsBucketName();
    const region = Config.getAWSRegion();
    return new FhirToCsvIncrementalDirect(analyticsBucketName, region);
  }
  return new FhirToCsvIncrementalCloud();
}
