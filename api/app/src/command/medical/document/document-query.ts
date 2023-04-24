import { Transaction } from "sequelize";
import {
  DocumentQueryStatus,
  DocumentQueryProgress,
} from "../../../domain/medical/document-reference";
import { processAsyncError } from "../../../errors";
import { queryDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { getPatientOrFail } from "../patient/get-patient";

export type DocumentQueryResp = {
  queryStatus: DocumentQueryStatus;
  queryProgress: DocumentQueryProgress | undefined;
};

// TODO: eventually we will have to update this to support multiple HIEs
export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
}): Promise<DocumentQueryResp> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.documentQueryStatus === "processing")
    return createQueryResponse("processing", patient);

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryResponse("completed", patient);

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryResponse("completed", patient);

  await updateDocQuery({ patient, status: "processing" });

  // intentionally asynchronous, not waiting for the result
  getDocumentsFromCW({ patient, facilityId }).catch(
    processAsyncError(`doc.list.getDocumentsFromCW`)
  );

  return createQueryResponse("processing", patient);
}

const createQueryResponse = (status: DocumentQueryStatus, patient: Patient): DocumentQueryResp => {
  return { queryStatus: status, queryProgress: patient.data.documentQueryProgress };
};

export const updateDocQuery = async ({
  patient,
  status,
  progress,
}: {
  patient: Patient;
  status: DocumentQueryStatus;
  progress?: {
    completed: number;
    total: number;
  };
}) => {
  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Missing sequelize");

  let transaction: Transaction | undefined = await sequelize.transaction();

  try {
    const existing = await PatientModel.findOne({
      where: {
        id: patient.id,
        cxId: patient.cxId,
      },
      lock: true,
      transaction,
    });

    if (existing) {
      return await existing.update(
        {
          data: {
            ...patient.data,
            documentQueryStatus: status,
            documentQueryProgress: progress,
          },
        },
        { transaction }
      );
    }
  } catch (error) {
    await transaction.rollback();
    transaction = undefined;
    throw error;
  } finally {
    if (transaction) await transaction.commit();
  }
};
