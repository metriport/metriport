import { DocumentDownloadStatus } from "../../../domain/medical/document-bulk-download";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
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
  patient,
  successful,
  errors,
  status,
  requestId,
}: SetDocBulkDownloadProgress): Promise<Patient> {
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
