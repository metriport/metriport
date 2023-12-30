import {
  getStatusFromProgress,
  Progress,
  DocumentQueryProgress,
  progressTypes,
  DocumentQueryStatus,
} from "../../../domain/medical/document-query";
import { MedicalDataSource } from "../../../external";
import { Patient, PatientExternalData } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";
import { processDocQueryProgressWebhook } from "../document/process-doc-query-webhook";
import { PatientDataCommonwell } from "../../../external/commonwell/patient-shared";
import { PatientDataCarequality } from "../../../external/carequality/patient-shared";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  convertibleDownloadErrors?: number;
  increaseCountConvertible?: number;
  requestId: string;
} & (
  | {
      downloadProgress?: Progress | undefined | null;
      convertProgress?: Progress | undefined | null;
      source?: MedicalDataSource;
      reset?: false | undefined;
    }
  | {
      downloadProgress: Progress;
      convertProgress?: never;
      source?: never;
      reset?: true;
    }
);

// SHOULD MAKE SOURCE OPTIONAL AND NEED TO HANDLE THIS
/**
 * Appends the given properties of a patient's document query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns
 */

// purpose of this is to be able to update the overall progress and to hie progresses
// but now im considering also using this to send webhooks if its complete
export async function appendDocQueryProgress({
  patient,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
  reset,
  requestId,
  source,
}: SetDocQueryProgress): Promise<Patient> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const initDocQueryProgress =
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
    const docQueryProgress = setDocQueryProgress(initDocQueryProgress, externalData);

    docQueryProgress.requestId = requestId;

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        docQueryProgress,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    await processDocQueryProgressWebhook({
      patient,
      docQueryProgress,
      requestId,
    });

    return updatedPatient;
  });
}

// MOVE TO EXTERNAL FOLDER
function setExternalData(
  reset: boolean | undefined,
  patient: PatientModel,
  downloadProgress: Progress | undefined | null,
  convertProgress: Progress | undefined | null,
  source?: MedicalDataSource,
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
  } else if (!source) {
    return externalData;
  }

  const sourceData = externalData[source] as PatientDataCarequality | PatientDataCommonwell;

  externalData[source] = {
    ...externalData[source],
    documentQueryProgress: {
      ...(downloadProgress
        ? {
            download: {
              ...sourceData?.documentQueryProgress?.download,
              ...downloadProgress,
            },
          }
        : {}),
      ...(convertProgress
        ? {
            convert: {
              ...sourceData?.documentQueryProgress?.convert,
              ...convertProgress,
            },
          }
        : {}),
    },
  };

  const convert = sourceData.documentQueryProgress?.convert;

  if (convert && convertibleDownloadErrors != null && convertibleDownloadErrors > 0) {
    convert.total = Math.max((convert.total ?? 0) - convertibleDownloadErrors, 0);
    // since we updated the total above, we should update the status as well
    convert.status = getStatusFromProgress(convert);
  }

  if (convert && increaseCountConvertible != null && increaseCountConvertible !== 0) {
    convert.total = Math.max(0, (convert.total ?? 0) + increaseCountConvertible);

    convert.status = getStatusFromProgress(convert);
  }

  return externalData;
}

// MOVE TO EXTERNAL FOLDER
function setDocQueryProgress(
  documentQueryProgress: DocumentQueryProgress,
  externalData: PatientExternalData
): DocumentQueryProgress {
  const cwExternalData = externalData.COMMONWELL as PatientDataCommonwell;
  const cqExternalData = externalData.CAREQUALITY as PatientDataCarequality;

  const cwProgress = cwExternalData?.documentQueryProgress ?? {};
  const cqProgress = cqExternalData?.documentQueryProgress ?? {};

  const result = documentQueryProgress;

  const progresses: DocumentQueryProgress[] = [cwProgress, cqProgress];

  const docProgress = aggregateDocProgress(progresses);

  return {
    ...result,
    ...docProgress,
  };
}

type RequiredProgress = Required<Progress>;

// UNIT TESTS
function aggregateDocProgress(hieDocProgresses: DocumentQueryProgress[]): {
  download?: RequiredProgress;
  convert?: RequiredProgress;
} {
  const tallyResults = hieDocProgresses.reduce(
    (acc: { download?: RequiredProgress; convert?: RequiredProgress }, progress) => {
      for (const type of progressTypes) {
        const progressType = progress[type];

        if (progressType) {
          const statuses: DocumentQueryStatus[] = [];

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
