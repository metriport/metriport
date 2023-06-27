import { DocumentReference } from "@medplum/fhirtypes";
import { capture } from "../../../shared/notifications";
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
  try {
    for await (const page of api.searchResourcePages("DocumentReference", `patient=${patientId}`)) {
      docs.push(...page);
    }
  } catch (error) {
    const msg = `Error getting documents for patient ${patientId} from FHIR server`;
    console.log(msg, error);
    capture.message(msg, { extra: { patientId, error }, level: "error" });
    throw error;
  }
  return docs;
};
