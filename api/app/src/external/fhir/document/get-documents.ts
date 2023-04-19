import { DocumentReference } from "@medplum/fhirtypes";
import { api } from "../api";

export const getDocuments = async ({
  patientId,
}: {
  patientId: string;
}): Promise<DocumentReference[] | undefined> => {
  return api.searchResources("DocumentReference", `patient=${patientId}`);
};
