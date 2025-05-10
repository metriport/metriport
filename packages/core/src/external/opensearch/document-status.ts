import { DocumentReference } from "@medplum/fhirtypes";

export function isDocStatusReady(doc: DocumentReference): boolean {
  return !isDocStatusPreliminary(doc) && !isDocStatusEnteredInError(doc);
}

export function isDocStatusPreliminary(doc: DocumentReference): boolean {
  return doc.docStatus === "preliminary";
}

export function isDocStatusEnteredInError(doc: DocumentReference): boolean {
  return doc.docStatus === "entered-in-error";
}
