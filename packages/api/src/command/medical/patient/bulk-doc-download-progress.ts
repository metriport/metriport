import {
  DocumentDownloadStatus,
  DocumentBulkDownloadProgress,
} from "../../../domain/medical/document-bulk-download";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type SetDocBulkDownloadProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  successful?: number;
  errors?: number;
  status?: DocumentDownloadStatus;
  requestId?: string;
};

/**
 * The function `appendDocBulkDownloadProgress` updates the progress of a bulk document download to a
 * patient's data.
 * @param {SetDocBulkDownloadProgress}  - - A cmd argument type to update the progress of a bulk document download.
 * @returns a Promise that resolves to a Patient object.
 */
export async function appendDocBulkDownloadProgress({
  patient: { id, cxId },
  successful,
  errors,
  status,
  requestId,
}: SetDocBulkDownloadProgress): Promise<Patient> {
  const patientFilter = {
    id: id,
    cxId: cxId,
  };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const documentBulkDownloadProgress = existingPatient.data?.documentBulkDownloadProgress || {};

    // Initialize download object if not present
    if (documentBulkDownloadProgress.urlGeneration) {
      // Updating only if the properties are not undefined
      if (successful) {
        documentBulkDownloadProgress.urlGeneration.successful = successful;
      }
      if (errors) {
        documentBulkDownloadProgress.urlGeneration.errors = errors;
      }
      // Ensure status is only assigned if not undefined
      if (status) {
        documentBulkDownloadProgress.urlGeneration.status = status;
      }
      if (requestId) {
        documentBulkDownloadProgress.requestId = requestId;
      }
    }

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        documentBulkDownloadProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
    return updatedPatient;
  });
}

export type BulkDownloadQueryInitCmd = BaseUpdateCmdWithCustomer & {
  documentBulkDownloadProgress: Required<Pick<DocumentBulkDownloadProgress, "urlGeneration">>;
  requestId: string;
  totalDocuments?: number;
};

/**
 * The function `storeBulkDownloadQueryInit` initalizes the `documentBulkDownloadProgress`field in a patient's data.
 * @param {BulkDownloadQueryInitCmd} cmd - The `cmd` argument type to initialize the `documentBulkDownloadProgress` field
 * @returns a Promise that resolves to a Patient object.
 */
export const storeBulkDownloadQueryInit = async (
  cmd: BulkDownloadQueryInitCmd
): Promise<Patient> => {
  const { id, cxId, totalDocuments } = cmd;

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    const update = {
      documentBulkDownloadProgress: {
        ...cmd.documentBulkDownloadProgress,
        total: totalDocuments,
      },
      requestId: cmd.requestId,
    };

    return patient.update(
      {
        data: {
          ...patient.data,
          ...update,
        },
      },
      { transaction }
    );
  });
};
