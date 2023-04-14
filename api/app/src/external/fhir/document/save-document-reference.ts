import { DocumentReference } from "@medplum/fhirtypes";
import { api } from "../api";
import { capture } from "../../../shared/notifications";

export const upsertDocumentToFHIRServer = async (docRef: DocumentReference) => {
  try {
    await api.updateResource({
      id: docRef.masterIdentifier?.value,
      ...docRef,
    });
  } catch (err) {
    capture.error(err, {
      extra: { context: `fhir.add.documentReference` },
    });
  }
};
