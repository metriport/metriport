import { getOrCreateDocRefMapping } from "../command/medical/docref-mapping/get-docref-mapping";
import { MedicalDataSource } from "@metriport/core/external/index";

/**
 * @deprecated Use @metriport/core instead
 */
export const createS3FileName = (cxId: string, patientId: string, fileName: string): string => {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${fileName}`;
};

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
