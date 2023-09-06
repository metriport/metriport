import { DocumentReference } from "@medplum/fhirtypes";
import { errorToString } from "../../../shared/log";
import { makeFhirApi } from "../api/api-factory";

export const upsertDocumentToFHIRServer = async (
  cxId: string,
  docRef: DocumentReference
): Promise<void> => {
  const fhir = makeFhirApi(cxId);
  try {
    await fhir.updateResource({
      id: docRef.id,
      ...docRef,
    });
  } catch (err) {
    console.log(`[upsertDocumentToFHIRServer] ${errorToString(err)}`);
    throw err;
  }
};
