import { Extension } from "@medplum/fhirtypes";
import { BASE_EXTENSION_URL } from "./base-extension";

// TODO #712: create this extension
export const DOC_ID_EXTENSION_URL = `${BASE_EXTENSION_URL}/doc-id-extension.json`;

export type DocIdExtension = Required<Pick<Extension, "url" | "valueString">>;

export function buildDocIdFHIRExtension(docId: string): DocIdExtension {
  return {
    url: DOC_ID_EXTENSION_URL,
    valueString: docId,
  };
}
