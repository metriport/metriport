import { Extension } from "@medplum/fhirtypes";
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

export function isCarequalityExtension(e: Extension): boolean {
  return e.valueCoding?.code === cqExtension.valueCoding.code;
}
