import { DocumentReference } from "@medplum/fhirtypes";
import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";

/**
 * @deprecated Use `getDocuments()` from `@metriport/core/external/fhir/document/get-documents` instead.
 */
export async function getDocumentsFromFHIR(
  ...params: Parameters<typeof getDocuments>
): Promise<DocumentReference[]> {
  return getDocuments(...params);
}
