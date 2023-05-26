import { Coding, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { METRIPORT } from "../../../../shared/constants";
import { isCommonwellContent } from "../../../commonwell/extension";
import { BASE_EXTENSION_URL } from "./base-extension";
import { DeepRequired } from "ts-essentials";

// TODO #712: create this extension
const DATA_SOURCE_EXTENSION_URL = `${BASE_EXTENSION_URL}/data-source.json`;

// URL is required: https://www.hl7.org/fhir/R4/extensibility.html#Extension.url
export type MetriportExtension = Omit<Extension, "url" | "valueCoding"> &
  Required<Pick<Extension, "url">> & {
    valueCoding: Omit<Coding, "system" | "code"> & DeepRequired<Pick<Coding, "system" | "code">>;
  };

export const dataSourceExtensionDefaults = {
  url: DATA_SOURCE_EXTENSION_URL,
  valueCoding: {
    system: DATA_SOURCE_EXTENSION_URL,
  },
};

export const metriportExtension: MetriportExtension = {
  ...dataSourceExtensionDefaults,
  valueCoding: {
    ...dataSourceExtensionDefaults.valueCoding,
    code: METRIPORT,
  },
};

export function isMetriportExtension(e: Extension): boolean {
  return e.valueCoding?.code === metriportExtension.valueCoding.code;
}
export function isMetriportContent(content: DocumentReferenceContent): boolean {
  // Metriport is the fallback/default.
  // All doc refs created before this extension was added will have only one content element,
  // stored on S3 (Metriport) and w/o the extension.
  // So, return true if it's explicitly Metriport or is not explicitly CommonWell.
  return content.extension?.some(isMetriportExtension) === true || !isCommonwellContent(content);
}
