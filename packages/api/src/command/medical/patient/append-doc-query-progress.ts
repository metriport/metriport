import {
  getStatusFromProgress,
  Progress,
  DocumentQueryProgress,
} from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  convertibleDownloadErrors?: number;
  increaseCountConvertible?: number;
  requestId: string;
} & (
  | {
      downloadProgress?: Progress | undefined | null;
      convertProgress?: Progress | undefined | null;
      reset?: false | undefined;
    }
  | {
      downloadProgress: Progress;
      convertProgress?: never;
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

    const documentQueryProgress =
      reset || !existingPatient.data.documentQueryProgress
        ? {}
        : existingPatient.data.documentQueryProgress;

    const updatedDocumentQueryProgress = setDocQueryProgress(
      documentQueryProgress,
      downloadProgress,
      convertProgress,
      convertibleDownloadErrors,
      increaseCountConvertible
    );

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
