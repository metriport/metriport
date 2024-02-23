import { MedicalDataSource } from "@metriport/api-sdk";
import { dataSourceExtensionDefaults } from "../fhir/shared/extensions/extension";
import { DataSourceExtension } from "../fhir/shared/extensions/metriport";

export const cqExtension: DataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: MedicalDataSource.CAREQUALITY,
  },
};
