import { MedicalDataSource } from "@metriport/core/external/index";
import { getOrCreateDocRefMapping } from "../command/medical/docref-mapping/get-docref-mapping";

export const mapDocRefToMetriport = async ({
  cxId,
  patientId,
  requestId,
  documentId,
  source,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  documentId: string;
  source: MedicalDataSource;
}): Promise<{ originalId: string; metriportId: string }> => {
  const docRef = { cxId, patientId, requestId, externalId: documentId, source };
  const existingDocRef = await getOrCreateDocRefMapping(docRef);
  return { originalId: documentId, metriportId: existingDocRef.id };
};
