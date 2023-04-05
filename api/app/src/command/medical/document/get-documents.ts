import { DocumentQueryStatus, DocumentReference } from "../../../domain/medical/document-reference";
import { DocumentReferenceModel } from "../../../models/medical/document-reference";
import { Patient } from "../../../models/medical/patient";
import { getPatientOrFail } from "../patient/get-patient";

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

export const updateDocQueryStatus = async ({
  patient,
  status,
}: {
  patient: Patient;
  status: DocumentQueryStatus;
}): Promise<void> => {
  const patientModel = await getPatientOrFail({ id: patient.id, cxId: patient.cxId });
  await patientModel.update({
    data: {
      ...patient.data,
      documentQueryStatus: status,
    },
  });
};
