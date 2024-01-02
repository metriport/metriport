import {
  Progress,
  DocumentQueryProgress,
  getStatusFromProgress,
} from "../../../domain/medical/document-query";
import { MedicalDataSource } from "../../../external";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";
import { processDocQueryProgressWebhook } from "../document/process-doc-query-webhook";
import { setExternalData, setDocQueryProgressWithExternal } from "../../../external/hie";

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

/**
 * Appends the given properties of a patient's document query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns
 */
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

    let documentQueryProgress =
      reset || !existingPatient.data.documentQueryProgress
        ? {}
        : existingPatient.data.documentQueryProgress;

    if (source) {
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
      documentQueryProgress = setDocQueryProgressWithExternal(documentQueryProgress, externalData);
    } else {
      documentQueryProgress = setDocQueryProgress(
        documentQueryProgress,
        downloadProgress,
        convertProgress,
        convertibleDownloadErrors,
        increaseCountConvertible
      );
    }

    documentQueryProgress.requestId = requestId;

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentQueryProgress,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });

    // NEED TO MOCK
    // await processDocQueryProgressWebhook({
    //   patient,
    //   documentQueryProgress,
    //   requestId,
    // });

    return updatedPatient;
  });
}

export const setDocQueryProgress = (
  documentQueryProgress: DocumentQueryProgress,
  downloadProgress?: Progress | undefined | null,
  convertProgress?: Progress | undefined | null,
  convertibleDownloadErrors?: number,
  increaseCountConvertible?: number
): DocumentQueryProgress => {
  if (downloadProgress) {
    documentQueryProgress.download = {
      ...documentQueryProgress.download,
      ...downloadProgress,
    };
  } else if (downloadProgress === null) {
    documentQueryProgress.download = undefined;
  }

  if (convertProgress) {
    documentQueryProgress.convert = {
      ...documentQueryProgress.convert,
      ...convertProgress,
    };
  } else if (convertProgress === null) {
    documentQueryProgress.convert = undefined;
  }

  const convert = documentQueryProgress.convert;

  if (convert && convertibleDownloadErrors != null && convertibleDownloadErrors > 0) {
    convert.total = Math.max((convert.total ?? 0) - convertibleDownloadErrors, 0);
    // since we updated the total above, we should update the status as well
    convert.status = getStatusFromProgress(convert);
  }

  if (convert && increaseCountConvertible != null && increaseCountConvertible !== 0) {
    convert.total = Math.max(0, (convert.total ?? 0) + increaseCountConvertible);

    convert.status = getStatusFromProgress(convert);
  }

  return documentQueryProgress;
};
