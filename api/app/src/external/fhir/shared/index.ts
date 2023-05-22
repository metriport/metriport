import { Bundle, DocumentReference, OperationOutcomeIssue, Resource } from "@medplum/fhirtypes";
import { isCommonwellExtension } from "../../commonwell/extension";
import { makeFhirApi } from "../api/api-factory";

export enum ResourceType {
  Organization = "Organization",
  Patient = "Patient",
  DocumentReference = "DocumentReference",
}

export function operationOutcomeIssueToString(i: OperationOutcomeIssue): string {
  return i.diagnostics ?? i.details?.text ?? i.code ?? "Unknown error";
}

export const MAX_FHIR_DOC_ID_LENGTH = 64;

export async function postFHIRBundle(cxId: string, bundle: Bundle): Promise<Bundle<Resource>> {
  const fhir = makeFhirApi(cxId);
  return fhir.executeBatch(bundle);
}

export function downloadedFromCW(doc: DocumentReference): boolean {
  return doc.extension?.some(isCommonwellExtension) ?? false;
}
export function downloadedFromHIEs(doc: DocumentReference): boolean {
  return downloadedFromCW(doc);
}
