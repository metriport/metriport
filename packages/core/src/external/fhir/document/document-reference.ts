import { DocumentReference, Resource } from "@medplum/fhirtypes";

export type DocumentReferenceWithId = Omit<DocumentReference, "id"> &
  Required<Pick<DocumentReference, "id">>;

export function hasId(docRef: DocumentReference): docRef is DocumentReferenceWithId {
  return !!docRef.id;
}

export function isDocumentReference(
  resource?: Resource | undefined
): resource is DocumentReference {
  return resource?.resourceType === "DocumentReference";
}
