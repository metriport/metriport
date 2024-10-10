import { DocumentReference } from "@medplum/fhirtypes";
import { ensureValidPeriod } from "../shared";
import { isDocStatusSuperseded } from "../../external/opensearch/index";

export function processDocumentReferences(
  documentReferences: DocumentReference[]
): DocumentReference[] {
  return documentReferences
    .filter(doc => !isDocStatusSuperseded(doc))
    .map(ensureFhirValidDocumentReference);
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
