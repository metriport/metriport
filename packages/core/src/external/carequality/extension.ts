import { DocumentReference, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { MedicalDataSource } from "@metriport/api-sdk";
import { dataSourceExtensionDefaults } from "../../external/fhir/shared/extensions/extension";
import { MetriportDataSourceExtension } from "../../external/fhir/shared/extensions/metriport";

export const cqExtension: MetriportDataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: MedicalDataSource.CAREQUALITY,
  },
};

export function isCarequalityExtension(e: Extension): boolean {
  return (
    e.valueReference?.reference === MedicalDataSource.CAREQUALITY || // Legacy FHIR resources have this
    e.valueCoding?.code === cqExtension.valueCoding.code
  );
}
export function isCarequalityContent(content: DocumentReferenceContent): boolean {
  return (
    content.extension?.some(isCarequalityExtension) === true ||
    // content.attachment?.url?.includes("commonwellalliance.org") || // Legacy FHIR resources only have this
    false
  );
}

export function hasCarequalityContent(doc: DocumentReference): boolean {
  return doc.content?.some(isCarequalityContent) ?? false;
}
