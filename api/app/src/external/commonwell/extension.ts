import { DocumentReference, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { MedicalDataSource } from "@metriport/api";
import {
  dataSourceExtensionDefaults,
  MetriportExtension,
} from "../fhir/shared/extensions/extension";

export const cwExtension: MetriportExtension = {
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
