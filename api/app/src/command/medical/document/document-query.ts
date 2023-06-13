import { Transaction } from "sequelize";
import {
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
  ConvertResult,
} from "../../../domain/medical/document-reference";
import { processAsyncError } from "../../../errors";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { Util } from "../../../shared/util";
import { getPatientOrFail } from "../patient/get-patient";
import {
  MAPIWebhookStatus,
  MAPIWebhookType,
  processPatientDocumentRequest,
} from "../../webhook/medical";

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
  if (
    patient.data.documentQueryProgress?.download?.status === "processing" ||
    patient.data.documentQueryProgress?.convert?.status === "processing"
  ) {
    log(`Patient ${patientId} documentQueryStatus is already 'processing', skipping...`);
    return createQueryResponse("processing", patient);
  }

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return createQueryResponse("failed");

  const cwData = externalData as PatientDataCommonwell;
  if (!cwData.patientId) return createQueryResponse("failed");

  await updateDocQuery({
    patient: { id: patient.id, cxId: patient.cxId },
    downloadProgress: { status: "processing" },
    restart: true,
  });

  // intentionally asynchronous, not waiting for the result
  getDocumentsFromCW({ patient, facilityId, override })
    .then((amountProcessed: number) => {
      log(`Finished processing ${amountProcessed} documents.`);
    })
    .catch(err => {
      updateDocQuery({
        patient: { id: patient.id, cxId: patient.cxId },
        downloadProgress: { status: "failed" },
      });
      processAsyncError(`doc.list.getDocumentsFromCW`)(err);
    });

  return createQueryResponse("processing", patient);
}

export const createQueryResponse = (
  status: DocumentQueryStatus,
  patient?: Patient
): DocumentQueryProgress => {
  return {
    download: {
      status,
      ...patient?.data.documentQueryProgress?.download,
    },
    ...patient?.data.documentQueryProgress,
  };
};

type UpdateDocQueryParams = {
  patient: Pick<Patient, "id" | "cxId">;
  downloadProgress?: Progress;
  convertProgress?: Progress;
  convertResult?: ConvertResult;
  restart?: boolean;
};

export const updateDocQuery = async ({
  patient,
  downloadProgress,
  convertProgress,
  convertResult,
  restart,
}: UpdateDocQueryParams) => {
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
      const docQueryProgressConvert = setDocQueryProgress({
        patient: existing,
        downloadProgress,
        convertProgress,
        convertResult,
        restart,
      });

      const updatedPatient = await existing.update(
        {
          data: {
            ...existing.data,
            documentQueryProgress: docQueryProgressConvert,
          },
        },
        { transaction }
      );

      const docQueryProgressStatus = updatedPatient.data.documentQueryProgress?.convert?.status;

      if (docQueryProgressStatus === "completed") {
        processPatientDocumentRequest(
          patient.cxId,
          patient.id,
          MAPIWebhookType.documentConversion,
          MAPIWebhookStatus.completed
        );
      }

      return updatedPatient;
    }
  } catch (error) {
    await transaction.rollback();
    transaction = undefined;
    throw error;
  } finally {
    transaction && (await transaction.commit());
  }
};

const setDocQueryProgress = ({
  patient,
  downloadProgress,
  convertProgress,
  convertResult,
  restart,
}: Omit<UpdateDocQueryParams, "patient"> & { patient: Patient }): DocumentQueryProgress => {
  if (restart) {
    return { download: downloadProgress };
  }

  const patientDocProgress = patient.data.documentQueryProgress;

  const docQueryProgress = {
    ...patientDocProgress,
  };

  if (downloadProgress) {
    docQueryProgress.download = {
      ...patientDocProgress?.download,
      ...downloadProgress,
    };
  }

  if (convertProgress) {
    docQueryProgress.convert = {
      ...patientDocProgress?.convert,
      ...convertProgress,
    };
  }

  if (convertResult) {
    const successfulConvert = patientDocProgress?.convert?.successful ?? 0;
    const errorsConvert = patientDocProgress?.convert?.errors ?? 0;
    const totalToConvert = patientDocProgress?.convert?.total ?? 0;
    const docQueryProgressStatus = successfulConvert + errorsConvert + 1 >= totalToConvert;

    if (convertResult === "success") {
      docQueryProgress.convert = {
        ...patientDocProgress?.convert,
        status: docQueryProgressStatus ? "completed" : "processing",
        successful: successfulConvert + 1,
      };
    } else if (convertResult === "failed") {
      docQueryProgress.convert = {
        ...patientDocProgress?.convert,
        status: docQueryProgressStatus ? "completed" : "processing",
        errors: errorsConvert + 1,
      };
    }
  }

  return docQueryProgress;
};
