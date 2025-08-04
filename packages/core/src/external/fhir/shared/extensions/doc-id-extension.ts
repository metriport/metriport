import { Extension } from "@medplum/fhirtypes";
import { BASE_EXTENSION_URL } from "./base-extension";

// TODO #712: create this extension
export const DOC_ID_EXTENSION_URL = `${BASE_EXTENSION_URL}/doc-id-extension.json`;

export type DocIdExtension = Required<Pick<Extension, "url" | "valueString">>;

export function buildDocIdFhirExtension(docId: string, location?: "hl7"): DocIdExtension {
  const locationParam = location ? `location=${location}/` : "";
  return {
    url: DOC_ID_EXTENSION_URL,
    valueString: locationParam + docId,
  };
}

export function findDocIdExtension(extensions: Extension[]): Extension | undefined {
  return extensions.find(isDocIdExtension);
}

export function isDocIdExtension(e: Extension): e is DocIdExtension {
  return e.url?.includes(DOC_ID_EXTENSION_URL) ?? false;
}
