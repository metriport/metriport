import { Transaction } from "sequelize";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
  Progress,
} from "../../../domain/medical/document-reference";
import { processAsyncError } from "../../../errors";
import { queryAndProcessDocuments as getDocumentsFromCW } from "../../../external/commonwell/document/document-query";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { Patient, PatientModel } from "../../../models/medical/patient";
import { startTransaction } from "../../../models/transaction";
import { Util } from "../../../shared/util";
import {
  MAPIWebhookStatus,
  MAPIWebhookType,
  processPatientDocumentRequest,
} from "../../webhook/medical";
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

  const updatedPatient = await updateDocQuery({
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

  return createQueryResponse("processing", updatedPatient);
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
  let transaction: Transaction | undefined = await startTransaction(PatientModel.prototype);

  try {
    const patientFilter = {
      id: patient.id,
      cxId: patient.cxId,
    };
    const existingPatient = await PatientModel.findOne({
      where: patientFilter,
      lock: true,
      transaction,
    });

    if (existingPatient) {
      const documentQueryProgress = getDocQueryProgress({
        patient: existingPatient,
        downloadProgress,
        convertProgress,
        convertResult,
        restart,
      });

      const updatedPatient = {
        ...existingPatient,
        data: {
          ...existingPatient.data,
          documentQueryProgress,
        },
      };
      await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

      const conversionStatus = documentQueryProgress.convert?.status;

      if (conversionStatus === "completed") {
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

export const getDocQueryProgress = ({
  patient,
  downloadProgress,
  convertProgress,
  convertResult,
  restart,
}: Omit<UpdateDocQueryParams, "patient"> & {
  patient: Pick<Patient, "data" | "id">;
}): DocumentQueryProgress => {
  if (restart) {
    return { download: downloadProgress };
  }

  const patientDocProgress = patient.data.documentQueryProgress ?? {};

  if (downloadProgress) {
    patientDocProgress.download = {
      ...patientDocProgress?.download,
      ...downloadProgress,
    };
  }

  if (convertProgress) {
    patientDocProgress.convert = {
      ...patientDocProgress?.convert,
      ...convertProgress,
    };
  }

  if (convertResult) {
    const totalToConvert = patientDocProgress?.convert?.total ?? 0;

    const successfulConvert = patientDocProgress?.convert?.successful ?? 0;
    const successful = convertResult === "success" ? successfulConvert + 1 : successfulConvert;

    const errorsConvert = patientDocProgress?.convert?.errors ?? 0;
    const errors = convertResult === "failed" ? errorsConvert + 1 : errorsConvert;

    const isConversionCompleted = successful + errors >= totalToConvert;
    const status = isConversionCompleted ? "completed" : "processing";

    patientDocProgress.convert = {
      ...patientDocProgress?.convert,
      status,
      successful,
      errors,
    };
  }

  return patientDocProgress;
};
