import { Extension } from "@medplum/fhirtypes";
import { dataSourceExtensionDefaults } from "../../fhir/shared/extensions/extension";

export function getSurescriptsDataSourceExtension(): Extension {
  return {
    ...dataSourceExtensionDefaults,
    valueCoding: {
      ...dataSourceExtensionDefaults.valueCoding,
      code: "SURESCRIPTS",
    },
  };
}
