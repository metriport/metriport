import { Progress, DocumentQueryProgress } from "../domain/medical/document-query";
import { MedicalDataSource } from ".";
import { PatientExternalData } from "../domain/medical/patient";
import { progressTypes } from "../domain/medical/document-query";
import { DocumentQueryStatus } from "../domain/medical/document-query";
import { Patient } from "../domain/medical/patient";
import { PatientModel } from "../models/medical/patient";
import { executeOnDBTx } from "../models/transaction-wrapper";
import {
  SetDocQueryProgress,
  setDocQueryProgress,
} from "../command/medical/patient/append-doc-query-progress";
import { getPatientOrFail } from "../command/medical/patient/get-patient";
import { processDocQueryProgressWebhook } from "../command/medical/document/process-doc-query-webhook";
import { PatientDataCommonwell } from "./commonwell/patient-shared";
import { PatientDataCarequality } from "./carequality/patient-shared";
import { getCWData } from "./commonwell/patient";
import { getCQData } from "./carequality/patient";

type HIEPatientData = PatientDataCommonwell | PatientDataCarequality;

type SetDocQueryProgressWithSource = SetDocQueryProgress & {
  source: MedicalDataSource;
};

/**
 * Appends the given properties of a patient's document query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns
 */
export async function appendDocQueryProgressWithSource({
  patient,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
  reset,
  requestId,
  source,
}: SetDocQueryProgressWithSource): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  const result = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const documentQueryProgress =
      reset || !existingPatient.data.documentQueryProgress
        ? {}
        : existingPatient.data.documentQueryProgress;

    // Set the doc query progress for the given hie
    const externalData = setExternalData(
      reset,
      existingPatient,
      downloadProgress,
      convertProgress,
      source,
      convertibleDownloadErrors,
      increaseCountConvertible
    );

    existingPatient.data.externalData = externalData;

    // Set the aggregated doc query progress for the patient
    const externalQueryProgresses = setDocQueryProgressWithExternal(externalData);

    const aggregatedDocProgress = aggregateDocProgress(externalQueryProgresses);

    const updatedDocumentQueryProgress = {
      ...documentQueryProgress,
      ...aggregatedDocProgress,
    };

    updatedDocumentQueryProgress.requestId = requestId;

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentQueryProgress: updatedDocumentQueryProgress,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });

  await processDocQueryProgressWebhook({
    patient: result.dataValues,
    documentQueryProgress: result.data.documentQueryProgress,
    requestId,
  });

  return result;
}

type RequiredProgress = Required<Progress>;

function aggregateDocProgress(hieDocProgresses: DocumentQueryProgress[]): {
  download?: RequiredProgress;
  convert?: RequiredProgress;
} {
  const statuses: DocumentQueryStatus[] = [];

  const tallyResults = hieDocProgresses.reduce(
    (acc: { download?: RequiredProgress; convert?: RequiredProgress }, progress) => {
      for (const type of progressTypes) {
        const progressType = progress[type];

        if (!progressType) continue;

        const currTotal = progressType.total ?? 0;
        const currErrors = progressType.errors ?? 0;
        const currSuccessful = progressType.successful ?? 0;
        const accType = acc[type];
        statuses.push(progressType.status);

        if (accType) {
          accType.total += currTotal;
          accType.errors += currErrors;
          accType.successful += currSuccessful;
          accType.status = setStatus(statuses);
        } else {
          acc[type] = {
            total: currTotal,
            errors: currErrors,
            successful: currSuccessful,
            status: progressType.status,
          };
        }
      }

      return acc;
    },
    {}
  );

  return tallyResults;
}

function setStatus(docQueryProgress: DocumentQueryStatus[]): DocumentQueryStatus {
  const hasProcessing = docQueryProgress.some(status => status === "processing");
  const hasFailed = docQueryProgress.some(status => status === "failed");

  if (hasProcessing) return "processing";
  if (hasFailed) return "failed";

  return "completed";
}

export function setExternalData(
  reset: boolean | undefined,
  patient: PatientModel,
  downloadProgress: Progress | undefined | null,
  convertProgress: Progress | undefined | null,
  source: MedicalDataSource,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number
): PatientExternalData {
  const externalData = patient.data.externalData ?? {};

  if (reset) {
    return {
      ...externalData,
      COMMONWELL: {
        ...externalData.COMMONWELL,
        documentQueryProgress: {},
      },
      CAREQUALITY: {
        ...externalData.CAREQUALITY,
        documentQueryProgress: {},
      },
    };
  }

  const sourceData = externalData[source] as HIEPatientData;

  const docQueryProgress = setDocQueryProgress(
    sourceData?.documentQueryProgress ?? {},
    downloadProgress,
    convertProgress,
    convertibleDownloadErrors,
    increaseCountConvertible
  );

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: docQueryProgress,
  };

  return externalData;
}

export function setDocQueryProgressWithExternal(
  externalData: PatientExternalData
): DocumentQueryProgress[] {
  const cwExternalData = getCWData(externalData);
  const cqExternalData = getCQData(externalData);

  const cwProgress = cwExternalData?.documentQueryProgress ?? {};
  const cqProgress = cqExternalData?.documentQueryProgress ?? {};

  const progresses: DocumentQueryProgress[] = [cwProgress, cqProgress];

  return progresses;
}
