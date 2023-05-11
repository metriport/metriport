import { DocumentReference } from "@medplum/fhirtypes";
import { makeFhirApi } from "../api";

export const upsertDocumentToFHIRServer = async (cxId: string, docRef: DocumentReference) => {
  await makeFhirApi(cxId).updateResource({
    id: docRef.id,
    ...docRef,
  });
};
