import {
  DocumentReference,
  DocumentReference as IHEGWDocumentReference,
} from "@metriport/ihe-gateway-sdk";

export type DocumentReferenceWithMetriportId = DocumentReference & {
  metriportId: string;
};

export function containsMetriportId(
  docRef: IHEGWDocumentReference
): docRef is DocumentReferenceWithMetriportId {
  return docRef.metriportId != undefined;
}

export function containsDuplicateMetriportId(
  docRef: DocumentReferenceWithMetriportId,
  seenMetriportIds: Set<string>
): boolean {
  if (seenMetriportIds.has(docRef.metriportId)) {
    return true;
  } else {
    seenMetriportIds.add(docRef.metriportId);
    return false;
  }
}

export function getContentTypeOrUnknown(docRef: DocumentReference) {
  return docRef.contentType ?? "unknown";
}
