import { Transaction } from "sequelize";
import {
  DocumentQueryProgress,
  DocumentQueryStatus,
} from "../../../domain/medical/document-reference";
import { processAsyncError } from "../../../errors";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";

// TODO: eventually we will have to update this to support multiple HIEs
export async function queryDocumentsAcrossHIEs({
  cxId,
  patientId,
  facilityId,
  override,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  override?: boolean;
}): Promise<DocumentQueryProgress> {
  const { log } = Util.out(`queryDocumentsAcrossHIEs - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (patient.data.documentQueryProgress?.status === "processing") {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryResponse("completed");

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryResponse("completed");

  await updateDocQuery({
    id: patient.id,
    cxId: patient.cxId,
    docQueryProgress: { status: "processing" },
    restart: true,
  });

  // intentionally asynchronous, not waiting for the result
  getDocumentsFromCW({ patient, facilityId, override })
    .then((amountProcessed: number) => {
      log(`Finished processing ${amountProcessed} documents.`);
    })
    .catch(err => {
      updateDocQuery({
        id: patient.id,
        cxId: patient.cxId,
        docQueryProgress: { status: "completed" },
      });
      processAsyncError(`doc.list.getDocumentsFromCW`)(err);
    });

  return createQueryResponse("processing", patient);
}

export const createQueryResponse = (
  status: DocumentQueryStatus,
  patient?: Patient
): DocumentQueryProgress => {
  if (status === "completed") {
    return { status };
  }

  return {
    status,
    ...patient?.data.documentQueryProgress,
  };
};

export const updateDocQuery = async ({
  id,
  cxId,
  docQueryProgress,
  restart,
}: {
  id: string;
  cxId: string;
  docQueryProgress: DocumentQueryProgress;
  restart?: boolean;
}) => {
  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Missing sequelize");

  let transaction: Transaction | undefined = await sequelize.transaction();

  try {
    const existing = await PatientModel.findOne({
      where: {
        id,
        cxId,
      },
      lock: true,
      transaction,
    });

    if (existing) {
      return await existing.update(
        {
          data: {
            ...existing.data,
            documentQueryProgress: restart
              ? { status: docQueryProgress.status }
              : {
                  ...existing.data.documentQueryProgress,
                  ...docQueryProgress,
                },
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
    transaction && (await transaction.commit());
  }
};
