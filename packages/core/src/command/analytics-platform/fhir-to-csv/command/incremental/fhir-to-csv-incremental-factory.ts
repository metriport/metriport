import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";
import { FhirToCsvIncrementalDirect } from "./fhir-to-csv-incremental-direct";
import { Config } from "../../../../../util/config";
import { readConfigs } from "../../configs/read-column-defs";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  if (Config.isDev()) {
    const fhirToCsvConfigurationsFolder = `../data-transformation/fhir-to-csv/src/parseFhir/configurations`;
    const tablesDefinitions = readConfigs(fhirToCsvConfigurationsFolder);
    return new FhirToCsvIncrementalDirect(
      Config.getAnalyticsBucketName(),
      Config.getAWSRegion(),
      Config.getAnalyticsDbCreds(),
      tablesDefinitions
    );
  }
  return new FhirToCsvIncrementalCloud();
}
