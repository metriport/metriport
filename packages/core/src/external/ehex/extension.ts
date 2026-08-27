import { Extension, DocumentReferenceContent, DocumentReference } from "@medplum/fhirtypes";
import { dataSourceExtensionDefaults } from "../fhir/shared/extensions/extension";
import { MetriportDataSourceExtension } from "../fhir/shared/extensions/metriport";
import { MedicalDataSource } from "..";

export const DOA_EXTENSION_URL = "https://sequoiaproject.org/fhir/sphd/StructureDefinition/DOA";

export const ehexExtension: MetriportDataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: MedicalDataSource.EHEX,
  },
};

export function isEhexExtension(e: Extension): boolean {
  return e.valueCoding?.code === ehexExtension.valueCoding.code;
}

export function isEhexContent(content: DocumentReferenceContent): boolean {
  return content.extension?.some(isEhexExtension) === true;
}

export function hasEhexExtension(doc: DocumentReference): boolean {
  return doc.extension?.some(isEhexExtension) ?? false;
}

export function isDoaExtension(e: Extension): boolean {
  return e.url?.toLowerCase().trim() === DOA_EXTENSION_URL.toLowerCase();
}
