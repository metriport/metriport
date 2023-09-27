import { DocumentReference } from "@medplum/fhirtypes";
import { Config } from "../../../shared/config";
import { isCommonwellExtension } from "../../commonwell/extension";
import { makeSearchServiceQuery } from "../../opensearch/file-search-connector-factory";
import { isMetriportExtension } from "../shared/extensions/metriport";
import { getDocuments } from "./get-documents";

export async function searchDocuments({
  cxId,
  patientId,
  dateRange: { from, to } = {},
  contentFilter,
}: {
  cxId: string;
  patientId: string;
  dateRange?: { from?: string; to?: string };
  contentFilter?: string;
}): Promise<DocumentReference[]> {
  const fhirDocs = await getDocuments({ cxId, patientId, from, to });

  const docs = await Promise.allSettled([
    searchDocumentsRaw(fhirDocs, contentFilter),
    searchDocumentsParsed(fhirDocs, contentFilter),
  ]);

  const result = [...docs.flatMap(d => (d.status === "fulfilled" ? d.value : []))];

  return result;
}

async function searchDocumentsParsed(
  docs: DocumentReference[],
  contentFilter?: string
): Promise<DocumentReference[]> {
  const checkContent = (d: DocumentReference) =>
    contentFilter ? JSON.stringify(d).toLocaleLowerCase().includes(contentFilter) : true;
  const result = docs.filter(d => checkExtensions(d) && checkContent(d));
  return result;
}

function checkExtensions(doc: DocumentReference) {
  // skip this check for sandbox as we don't have extensions in the sandbox doc refs
  // to be removed in #895
  if (Config.isSandbox()) return true;
  const extensions = doc.extension;
  if (!extensions) return false;
  const metriport = extensions.find(isMetriportExtension);
  const cw = extensions.find(isCommonwellExtension);
  if (!metriport && !cw) return false;
  return true;
}

async function searchDocumentsRaw(
  docs: DocumentReference[],
  contentFilter?: string
): Promise<DocumentReference[]> {
  if (!contentFilter) return [];
  const searchService = makeSearchServiceQuery();
  const searchResult = await searchService.search({ query: contentFilter });
  const searchResultIds = searchResult.map(r => r.entryId);
  // only return documents that match both the search result and the documents we got from the FHIR server (using date filter)
  const result = docs.filter(d => d.id && searchResultIds.includes(d.id));
  return result;
}
