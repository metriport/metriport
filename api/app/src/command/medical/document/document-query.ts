import { Transaction } from "sequelize";
import {
  ConvertResult,
  DocumentQueryProgress,
  DocumentQueryStatus,
} from "../../../domain/medical/document-reference";
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
import { appendDocQueryProgress, SetDocQueryProgress } from "../patient/append-doc-query-progress";
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
    reset: true,
  });

  // intentionally asynchronous, not waiting for the result
  getDocumentsFromCW({ patient, facilityId, override });

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

type UpdateResult = {
  patient: Pick<Patient, "id" | "cxId">;
  convertResult: ConvertResult;
};

type UpdateDocQueryParams =
  | (SetDocQueryProgress & { convertResult?: never })
  | (UpdateResult & { downloadProgress?: never; convertProgress?: never; reset?: never });

/**
 *
 * @param param.downloadProgress if undefined, don't update; if null, remove/reset it
 * @param param.convertProgress if undefined, don't update; if null, remove/reset it
 * @returns
 */
export async function updateDocQuery(params: UpdateDocQueryParams): Promise<Patient> {
  let updatedPatient: Patient;
  if (params.convertResult) {
    updatedPatient = await updateConversionProgress(params);
  } else {
    updatedPatient = await appendDocQueryProgress(params);
  }
  const conversionStatus = updatedPatient.data.documentQueryProgress?.convert?.status;

  const { patient } = params;
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

export const updateConversionProgress = async ({
  patient,
  convertResult,
}: UpdateResult): Promise<Patient> => {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  let transaction: Transaction | undefined = await startTransaction(PatientModel.prototype);
  try {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const documentQueryProgress = calculateConversionProgress({
      patient: existingPatient,
      convertResult,
    });

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentQueryProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    return updatedPatient;
  } catch (error) {
    await transaction.rollback();
    transaction = undefined;
    throw error;
  } finally {
    if (transaction) await transaction.commit();
  }
};

export const calculateConversionProgress = ({
  patient,
  convertResult,
}: UpdateResult & {
  patient: Pick<Patient, "data" | "id">;
}): DocumentQueryProgress => {
  const { log } = Util.out(`calculateConversionProgress - patient ${patient.id}`);
  const docQueryProgress = patient.data.documentQueryProgress ?? {};

  // TODO 785 remove this once we're confident with the flow
  log(
    `IN convert result: ${convertResult}; docQueryProgress : ${JSON.stringify(docQueryProgress)}`
  );

  const totalToConvert = docQueryProgress?.convert?.total ?? 0;

  const successfulConvert = docQueryProgress?.convert?.successful ?? 0;
  const successful = convertResult === "success" ? successfulConvert + 1 : successfulConvert;

  const errorsConvert = docQueryProgress?.convert?.errors ?? 0;
  const errors = convertResult === "failed" ? errorsConvert + 1 : errorsConvert;

  const isConversionCompleted = successful + errors >= totalToConvert;
  const status = isConversionCompleted ? "completed" : "processing";

  docQueryProgress.convert = {
    ...docQueryProgress?.convert,
    status,
    successful,
    errors,
  };

  // TODO 785 remove this once we're confident with the flow
  log(`OUT docQueryProgress: ${JSON.stringify(docQueryProgress)}`);
  return docQueryProgress;
};
