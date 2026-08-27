import { Config } from "../../../../../util/config";
import { rawDbSchema } from "../../../fwh/utils";
import { parseConfigsIntoColumnsByTableName } from "../../configs/read-column-defs";
import { FhirToCsvIncrementalHandler } from "./fhir-to-csv-incremental";
import { FhirToCsvIncrementalCloud } from "./fhir-to-csv-incremental-cloud";
import { FhirToCsvIncrementalDirect } from "./fhir-to-csv-incremental-direct";

export function buildFhirToCsvIncrementalHandler(): FhirToCsvIncrementalHandler {
  if (Config.isDev()) {
    const fhirToCsvConfigurationsFolder = `../data-transformation/fhir-to-csv/src/parseFhir/configurations`;
    const tablesDefinitions = parseConfigsIntoColumnsByTableName(fhirToCsvConfigurationsFolder);
    const dbCreds = Config.getAnalyticsDbCreds();
    const fhirToCsvUsername = Config.getFhirToCsvDbUsername();
    const fhirToCsvPassword = Config.getFhirToCsvDbPassword();
    return new FhirToCsvIncrementalDirect(tablesDefinitions, {
      ...dbCreds,
      schemaName: rawDbSchema,
      username: fhirToCsvUsername,
      password: fhirToCsvPassword,
    });
  }
  return new FhirToCsvIncrementalCloud();
}
