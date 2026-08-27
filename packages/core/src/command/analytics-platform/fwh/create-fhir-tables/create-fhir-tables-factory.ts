import { Config } from "../../../../util/config";
import { CreateFhirTablesDirect } from "./create-fhir-tables-direct";
import { CreateFhirTablesCloud } from "./create-fhir-tables-cloud";
import { CreateFhirTablesHandler } from "./create-fhir-tables";
import { parseConfigsIntoColumnsByTableName } from "../../fhir-to-csv/configs/read-column-defs";
import { rawDbSchema } from "../utils";

export function buildCreateFhirTablesHandler(): CreateFhirTablesHandler {
  if (Config.isDev()) {
    const fhirToCsvConfigurationsFolder = `../data-transformation/fhir-to-csv/src/parseFhir/configurations`;
    const tablesDefinitions = parseConfigsIntoColumnsByTableName(fhirToCsvConfigurationsFolder);
    const dbCreds = Config.getAnalyticsDbCreds();
    const fhirToCsvUsername = Config.getFhirToCsvDbUsername();
    const fhirToCsvPassword = Config.getFhirToCsvDbPassword();
    const rawToCoreUsername = Config.getRawToCoreDbUsername();
    const rawToCorePassword = Config.getRawToCoreDbPassword();
    const useMonthlyDeletedPartitions = false;
    return new CreateFhirTablesDirect(
      tablesDefinitions,
      {
        ...dbCreds,
        schemaName: rawDbSchema,
      },
      [
        { username: fhirToCsvUsername, password: fhirToCsvPassword },
        { username: rawToCoreUsername, password: rawToCorePassword },
      ],
      useMonthlyDeletedPartitions
    );
  }
  return new CreateFhirTablesCloud();
}
