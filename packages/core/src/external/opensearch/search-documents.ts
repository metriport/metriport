import { DocumentReference } from "@medplum/fhirtypes";
import { uniqBy } from "lodash";
import { isDocStatusReady } from ".";
import { updateMetaDataForDocRef } from "../../command/consolidated/consolidated-create";
import { Config } from "../../util/config";
import { log as _log } from "../../util/log";
import { capture } from "../../util/notifications";
import { isCarequalityExtension } from "../carequality/extension";
import { isCommonwellExtension } from "../commonwell/extension";
import { DocumentReferenceWithId } from "../fhir/document/document-reference";
import { getDocuments } from "../fhir/document/get-documents";
import { isMetriportExtension } from "../fhir/shared/extensions/metriport";
import { makeSearchServiceQuery } from "../opensearch/file-search-connector-factory";

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
  const ready = unique.filter(isDocStatusReady).map(updateMetaDataForDocRef);
  return ready;
}

async function searchOnDocumentReferences(
  docs: DocumentReferenceWithId[],
  contentFilter?: string
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
  contentFilter?: string
): Promise<DocumentReferenceWithId[]> {
  if (!contentFilter) return [];
  const searchService = makeSearchServiceQuery();
  const searchResult = await searchService.search({ query: contentFilter, cxId, patientId });
  const searchResultIds = searchResult.map(r => r.entryId);
  // only return documents that match both the search result and the documents we got from the FHIR server (using date filter)
  const result = docs.filter(d => searchResultIds.includes(d.id));
  return result;
}
