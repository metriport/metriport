import { DocumentReference } from "@medplum/fhirtypes";
import { api } from "../api";

export const getDocuments = async (query: string): Promise<DocumentReference[] | undefined> => {
  return api.searchResources("DocumentReference", query);
};
