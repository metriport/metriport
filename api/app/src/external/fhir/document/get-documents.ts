import { DocumentReference } from "@medplum/fhirtypes";
import { makeFhirApi } from "../api/api-factory";

export const getDocuments = async ({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<DocumentReference[] | undefined> => {
  const api = makeFhirApi(cxId);
  const docs: DocumentReference[] = [];
  for await (const page of api.searchResourcePages("DocumentReference", `patient=${patientId}`)) {
    docs.push(...page);
  }
  return docs;
};
