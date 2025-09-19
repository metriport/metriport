import { dbCredsSchema } from "@metriport/shared";
import { Config } from "../../../../../util/config";
import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";
import { FhirToCsvIncrementalDirect } from "./fhir-to-csv-incremental-direct";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  if (Config.isDev()) {
    const analyticsBucketName = Config.getAnalyticsBucketName();
    const region = Config.getAWSRegion();
    const dbCredsRaw = Config.getAnalyticsDbCreds();
    const dbCreds = dbCredsSchema.parse(JSON.parse(dbCredsRaw));
    return new FhirToCsvIncrementalDirect(analyticsBucketName, region, dbCreds);
  }
  return new FhirToCsvIncrementalCloud();
}
