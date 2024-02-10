import { DocumentReference, Resource } from "@medplum/fhirtypes";

export function isDocumentReference(resource: Resource): resource is DocumentReference {
  return resource.resourceType === "DocumentReference";
}
