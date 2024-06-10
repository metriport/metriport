import { DocumentReference, Resource } from "@medplum/fhirtypes";

export function isDocumentReference(
  resource?: Resource | undefined
): resource is DocumentReference {
  return resource?.resourceType === "DocumentReference";
}
