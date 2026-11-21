import { Coding, DocumentReference, DocumentReferenceContent, Extension } from "@medplum/fhirtypes";
import { isEhrSource } from "@metriport/shared/interface/external/ehr/source";
import { DeepRequired } from "ts-essentials";
import { METRIPORT } from "../../../../util/constants";
import { out } from "../../../../util/log";
import { capture } from "../../../../util/notifications";
import { isCarequalityContent } from "../../../carequality/extension";
import { isCommonwellContent } from "../../../commonwell/extension";
import { BASE_EXTENSION_URL } from "./base-extension";
import { DATA_SOURCE_EXTENSION_URL, dataSourceExtensionDefaults } from "./extension";

export const CX_ID_EXTENSION_URL = `${BASE_EXTENSION_URL}/customer-id`;

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

/**
 * Data the customer contributed, either directly (METRIPORT) or pulled from their EHR
 * (tagged with the EHR source, e.g. CANVAS), as opposed to data received from the HIEs.
 */
export function isCustomerDataSourceExtension(e: Extension): boolean {
  if (isMetriportExtension(e)) return true;
  if (e.url !== DATA_SOURCE_EXTENSION_URL) return false;
  const code = e.valueCoding?.code;
  return code ? isEhrSource(code.toLowerCase()) : false;
}
export function isMetriportContent(content: DocumentReferenceContent): boolean {
  // Metriport is the fallback/default.
  // All doc refs created before this extension was added will have only one content element,
  // stored on S3 (Metriport) and w/o the extension.
  // So, return true if it's explicitly Metriport or is not explicitly CommonWell and Carequality.
  return (
    content.extension?.some(isMetriportExtension) ||
    (!isCommonwellContent(content) && !isCarequalityContent(content))
  );
}

export function getMetriportContent(doc: DocumentReference): DocumentReferenceContent | undefined {
  if (!doc || !doc.content) return undefined;
  const contents = doc.content.filter(isMetriportContent);
  if (contents.length > 1) {
    const msg = "DocRef contains more than one Metriport content item";
    const extra = {
      id: doc.id,
      metriport_contents: contents.length,
    };
    const { log } = out("getMetriportContent");
    log(`${msg}, returning the first one - ${JSON.stringify(extra)}`);
    capture.message(msg, { extra, level: "warning" });
  }
  return contents[0];
}
