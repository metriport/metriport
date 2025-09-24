import { Extension } from "@medplum/fhirtypes";
import { BASE_EXTENSION_URL } from "./base-extension";

export const CODE_SOURCE_EXTENSION_URL = `${BASE_EXTENSION_URL}/code-source`;
export const VALUE_STRING = "SNOMED CT to ICD-10-CM Map";

export type CodeSourceExtension = Required<Pick<Extension, "url" | "valueString">>;

export const codeSourceFhirExtension: CodeSourceExtension = {
  url: CODE_SOURCE_EXTENSION_URL,
  valueString: VALUE_STRING,
};

export function findCodeSourceExtension(extensions: Extension[]): Extension | undefined {
  return extensions.find(isCodeSourceExtension);
}

export function isCodeSourceExtension(e: Extension): e is CodeSourceExtension {
  return e.url?.endsWith(CODE_SOURCE_EXTENSION_URL) ?? false;
}
