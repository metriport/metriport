import { DocumentReference, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { MedicalDataSource } from "@metriport/api-sdk";
import { dataSourceExtensionDefaults } from "../fhir/shared/extensions/extension";
import { DataSourceExtension } from "../fhir/shared/extensions/metriport";

export const cwExtension: DataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: MedicalDataSource.COMMONWELL,
  },
};

export function isCommonwellExtension(e: Extension): boolean {
  return (
    e.valueReference?.reference === MedicalDataSource.COMMONWELL || // Legacy FHIR resources have this
    e.valueCoding?.code === cwExtension.valueCoding.code
  );
}
export function isCommonwellContent(content: DocumentReferenceContent): boolean {
  return (
    content.extension?.some(isCommonwellExtension) === true ||
    content.attachment?.url?.includes("commonwellalliance.org") || // Legacy FHIR resources only have this
    false
  );
}

export function hasCommonwellContent(doc: DocumentReference): boolean {
  return doc.content?.some(isCommonwellContent) ?? false;
}
