import { getStatusFromProgress, Progress } from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { DocRequest } from "../../../domain/medical/doc-request";
import { PatientModel } from "../../../models/medical/patient";
import { DocRequestModel } from "../../../models/medical/doc-request";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "../patient/get-patient";
import { getDocRequestOrFail } from "./get-doc-request";

export type SetDocRequestQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  docRequest: Pick<DocRequest, "id">;
  convertibleDownloadErrors?: number;
  increaseCountConvertible?: number;
  requestId?: string | undefined;
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
 * Appends the given properties of a doc request's document query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns
 */
export async function appendDocRequestQueryProgress({
  patient,
  docRequest,
  downloadProgress,
  convertProgress,
  convertibleDownloadErrors,
  increaseCountConvertible,
  reset,
  requestId,
}: SetDocRequestQueryProgress): Promise<[DocRequest, Patient]> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
  const docRequestFilter = {
    id: docRequest.id,
    cxId: patient.cxId,
  };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const existingDocRequest = await getDocRequestOrFail({
      ...docRequestFilter,
      lock: true,
      transaction,
    });

    if (!existingDocRequest) {
      throw new Error("DocRequest not found");
    }

    const documentQueryProgress =
      reset || !existingPatient.data.documentQueryProgress
        ? {}
        : existingPatient.data.documentQueryProgress;

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

    documentQueryProgress.requestId = requestId;

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

    const updatedDocRequest: DocRequest = {
      ...existingDocRequest,
      documentQueryProgress,
    };
    await DocRequestModel.update(updatedDocRequest, { where: docRequestFilter, transaction });

    if (requestId) {
      existingPatient.data.docRequests = [...(existingPatient.data.docRequests || []), requestId];
    }

    const updatedPatient = {
      ...existingPatient,
      data: existingPatient.data,
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
    return [updatedDocRequest, updatedPatient];
  });
}
