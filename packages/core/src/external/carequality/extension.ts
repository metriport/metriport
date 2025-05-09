import { Extension, DocumentReferenceContent, DocumentReference } from "@medplum/fhirtypes";
import { dataSourceExtensionDefaults } from "../fhir/shared/extensions/extension";
import { MetriportDataSourceExtension } from "../fhir/shared/extensions/metriport";
import { MedicalDataSource } from "..";

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

export function hasCarequalityExtension(doc: DocumentReference): boolean {
  return doc.extension?.some(isCarequalityExtension) ?? false;
}
