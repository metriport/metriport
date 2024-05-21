/**
 * Created outside of src/external/aws because this is an open source technology
 * that could be hosted outside of AWS.
 */
import { DocumentReference } from "@medplum/fhirtypes";

export const contentFieldName = "content";

export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  [contentFieldName]: string;
};

export function isDocStatusReady(doc: DocumentReference): boolean {
  return !isDocStatusPreliminary(doc) && !isDocStatusEnteredInError(doc);
}
export function isDocStatusFinal(doc: DocumentReference): boolean {
  return doc.docStatus === "final";
}
export function isDocStatusAmended(doc: DocumentReference): boolean {
  return doc.docStatus === "amended";
}
export function isDocStatusPreliminary(doc: DocumentReference): boolean {
  return doc.docStatus === "preliminary";
}
export function isDocStatusEnteredInError(doc: DocumentReference): boolean {
  return doc.docStatus === "entered-in-error";
}
