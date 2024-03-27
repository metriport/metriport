import { Extension, DocumentReferenceContent } from "@medplum/fhirtypes";
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

export function isCarequalityExtension(e: Extension): boolean {
  return e.valueCoding?.code === cqExtension.valueCoding.code;
}

export function isCarequalityContent(content: DocumentReferenceContent): boolean {
  return content.extension?.some(isCarequalityExtension) === true;
}
