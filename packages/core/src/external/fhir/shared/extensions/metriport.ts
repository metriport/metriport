import { Coding, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { DeepRequired } from "ts-essentials";
import { METRIPORT } from "../../../../util/constants";
import { isCommonwellContent } from "../../../commonwell/extension";
import { dataSourceExtensionDefaults } from "./extension";

// URL is required: https://www.hl7.org/fhir/R4/extensibility.html#Extension.url
export type MetriportDataSourceExtension = Omit<Extension, "url" | "valueCoding"> &
  Required<Pick<Extension, "url">> & {
    valueCoding: Omit<Coding, "system" | "code"> & DeepRequired<Pick<Coding, "system" | "code">>;
  };

export const metriportDataSourceExtension: MetriportDataSourceExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: METRIPORT,
  },
};

export function isMetriportExtension(e: Extension): boolean {
  return e.valueCoding?.code === metriportDataSourceExtension.valueCoding.code;
}
export function isMetriportContent(content: DocumentReferenceContent): boolean {
  // Metriport is the fallback/default.
  // All doc refs created before this extension was added will have only one content element,
  // stored on S3 (Metriport) and w/o the extension.
  // So, return true if it's explicitly Metriport or is not explicitly CommonWell.
  return content.extension?.some(isMetriportExtension) === true || !isCommonwellContent(content);
}
