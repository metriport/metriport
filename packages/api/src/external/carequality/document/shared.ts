import { DocumentReference } from "@metriport/ihe-gateway-sdk";
import { IHEToExternalGwDocumentQuery } from "../ihe-to-external-gw-document-query";
import { IHEToExternalGwDocumentRetrieval } from "../ihe-to-external-gw-document-retrieval";

export type DocumentWithMetriportId = DocumentReference & {
  id: string;
  originalId: string;
};

type IHEResults = IHEToExternalGwDocumentQuery | IHEToExternalGwDocumentRetrieval;

// Create a single array of all the document references from all the document query results
export function combineDocRefs(documentQueryResults: IHEResults[]): DocumentReference[] {
  return documentQueryResults.reduce((acc: DocumentReference[], curr) => {
    const documentReferences = curr.data.documentReference ?? [];
    const documentReferencesWithUrl = documentReferences.map(docRef => {
      return {
        ...docRef,
        url: curr.data.gateway.url,
      };
    });

    return [...acc, ...documentReferencesWithUrl];
  }, []);
}
