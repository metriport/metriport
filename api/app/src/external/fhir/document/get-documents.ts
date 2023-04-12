import { DocumentReference } from "@medplum/fhirtypes";
import { api } from "../api";
import { capture } from "../../../shared/notifications";

export const getDocuments = async (patientId: string): Promise<DocumentReference[] | undefined> => {
  try {
    return api.searchResources("DocumentReference", `patient=${patientId}`);
  } catch (err) {
    capture.error(err, {
      extra: { context: `fhir.retrieve.documentReferences` },
    });
  }
};
