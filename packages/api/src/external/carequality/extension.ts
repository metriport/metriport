import { MedicalDataSource } from "@metriport/api-sdk";
import { dataSourceExtensionDefaults } from "../fhir/shared/extensions/extension";
import { MetriportDataSourceExtension } from "../fhir/shared/extensions/metriport";

export const cqExtension: MetriportDataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: MedicalDataSource.CAREQUALITY,
  },
};
