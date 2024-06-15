import { DocumentReference } from "@medplum/fhirtypes";
import { searchDocuments as searchDocumentsFromCore } from "@metriport/core/external/opensearch/search-documents";

/**
 * @deprecated Use `searchDocuments()` from `@metriport/core/external/opensearch/search-documents` instead.
 */
export async function searchDocuments(params: {
  cxId: string;
  patientId: string;
  dateRange?: { from?: string; to?: string };
  contentFilter?: string;
}): Promise<DocumentReference[]> {
  return searchDocumentsFromCore(params);
}
