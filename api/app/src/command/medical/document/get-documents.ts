import { DocumentReference } from "../../../domain/medical/document-reference";
import { DocumentReferenceModel } from "../../../models/medical/document-reference";

export const getDocuments = async ({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<DocumentReference[]> => {
  const documents = await DocumentReferenceModel.findAll({
    where: { cxId, patientId },
    order: [["created_at", "ASC"]],
  });
  return documents;
};
