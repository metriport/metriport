import { DocumentReference, OperationOutcomeIssue } from "@medplum/fhirtypes";
import { isCommonwellExtension } from "../../commonwell/extension";

export enum ResourceType {
  Organization = "Organization",
  Patient = "Patient",
  DocumentReference = "DocumentReference",
}

export function operationOutcomeIssueToString(i: OperationOutcomeIssue): string {
  return i.diagnostics ?? i.details?.text ?? i.code ?? "Unknown error";
}

export function downloadedFromCW(doc: DocumentReference): boolean {
  return doc.extension?.some(isCommonwellExtension) ?? false;
}
export function downloadedFromHIEs(doc: DocumentReference): boolean {
  return downloadedFromCW(doc);
}
