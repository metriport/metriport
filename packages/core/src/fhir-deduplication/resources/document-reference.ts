import { DocumentReference } from "@medplum/fhirtypes";
import { ensureValidPeriod } from "../shared";

export function processDocumentReferences(
  documentReferences: DocumentReference[]
): DocumentReference[] {
  return documentReferences.map(ensureFhirValidDocumentReference);
}

function ensureFhirValidDocumentReference(documentReference: DocumentReference) {
  const validPeriod = ensureValidPeriod(documentReference.context?.period);
  if (documentReference.context && validPeriod) {
    documentReference.context = {
      ...documentReference.context,
      period: validPeriod,
    };
  }
  return documentReference;
}
