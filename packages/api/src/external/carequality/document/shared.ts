import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { DocumentQueryResult } from "../document-query-result";
import { DocumentRetrievalResult } from "../document-retrieval-result";

export type DocumentWithMetriportId = DocumentReference & {
  id: string;
  originalId: string;
};

type IHEResults = DocumentQueryResult | DocumentRetrievalResult;

// NEED TO FIX BECUASE THIS DOES NOT HANDLE ERRORS
// Create a single array of all the document references from all the document query results
export function combineDocRefs(documentQueryResults: IHEResults[]): DocumentReference[] {
  return documentQueryResults.reduce((acc: DocumentReference[], curr) => {
    const documentReferences = curr.data.documentReference ?? [];

    return [...acc, ...documentReferences];
  }, []);
}
