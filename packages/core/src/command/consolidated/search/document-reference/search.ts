import { DocumentReference } from "@medplum/fhirtypes";
import { uniqBy } from "lodash";
import { isCarequalityExtension } from "../../../../external/carequality/extension";
import { isCommonwellExtension } from "../../../../external/commonwell/extension";
import { DocumentReferenceWithId } from "../../../../external/fhir/document/document-reference";
import { getDocuments } from "../../../../external/fhir/document/get-documents";
import { isMetriportExtension } from "../../../../external/fhir/shared/extensions/metriport";
import { insertSourceDocumentToDocRefMeta } from "../../../../external/fhir/shared/meta";
import { makeSearchServiceQuery } from "../../../../external/opensearch/file/file-search-connector-factory";
import { Config } from "../../../../util/config";
import { log as _log } from "../../../../util/log";
import { capture } from "../../../../util/notifications";

/**
 * Search for DocumentReference in the FHIR server and OpenSearch.
 *
 * The content filter is applied to:
 * - CCDA file content
 * - DocumentReference's content
 *
 * @param cxId - The customer ID
 * @param patientId - The patient ID
 * @param dateRange - The date range to search/filter on
 * @param contentFilter - The content filter to apply
 * @returns The list of DocumentReference resources
 */
export async function searchDocuments({
  cxId,
  patientId,
  dateRange: { from, to } = {},
  contentFilter,
}: {
  cxId: string;
  patientId: string;
  dateRange?: { from?: string; to?: string };
  contentFilter?: string | undefined;
}): Promise<DocumentReferenceWithId[]> {
  const log = _log("searchDocuments");
  const fhirDocs = await getDocuments({ cxId, patientId, from, to });

  const docs = await Promise.allSettled([
    searchOnCCDAFiles(fhirDocs, cxId, patientId, contentFilter),
    searchOnDocumentReferences(fhirDocs, contentFilter),
  ]);

  const success = [...docs.flatMap(d => (d.status === "fulfilled" ? d.value : []))];
  const failure = [...docs.flatMap(d => (d.status === "rejected" ? d.reason : []))];
  if (failure.length) {
    const msg = `Failure searching`;
    const extra = {
      failures: failure.join("; "),
      successCount: success.length,
      failureCount: failure.length,
    };
    log(`${msg}: ${JSON.stringify(extra)}`);
    capture.message(msg, { extra });
  }

  const unique = uniqBy(success, "id");
  const ready = unique.filter(isDocStatusReady).map(insertSourceDocumentToDocRefMeta);
  return ready;
}

async function searchOnDocumentReferences(
  docs: DocumentReferenceWithId[],
  contentFilter?: string | undefined
): Promise<DocumentReferenceWithId[]> {
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
  const hasMetriport = extensions.find(isMetriportExtension);
  const hasCW = extensions.find(isCommonwellExtension);
  const hasCQ = extensions.find(isCarequalityExtension);
  if (!hasMetriport && !hasCW && !hasCQ) return false;
  return true;
}

async function searchOnCCDAFiles(
  docs: DocumentReferenceWithId[],
  cxId: string,
  patientId: string,
  contentFilter?: string | undefined
): Promise<DocumentReferenceWithId[]> {
  const searchService = makeSearchServiceQuery();
  const searchResult = await searchService.search({ query: contentFilter, cxId, patientId });
  const searchResultIds = searchResult.map(r => r.entryId);
  // only return documents that match both the search result and the documents we got from the FHIR server (using date filter)
  const result = docs.filter(d => searchResultIds.includes(d.id));
  return result;
}

function isDocStatusReady(doc: DocumentReference): boolean {
  return !isDocStatusPreliminary(doc) && !isDocStatusEnteredInError(doc);
}

function isDocStatusPreliminary(doc: DocumentReference): boolean {
  return doc.docStatus === "preliminary";
}

function isDocStatusEnteredInError(doc: DocumentReference): boolean {
  return doc.docStatus === "entered-in-error";
}
