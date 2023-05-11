import { DocumentReference } from "@medplum/fhirtypes";
import { api } from "../api";

export const upsertDocumentToFHIRServer = async (docRef: DocumentReference) => {
  await api.updateResource({
    id: docRef.id,
    ...docRef,
  });
};
