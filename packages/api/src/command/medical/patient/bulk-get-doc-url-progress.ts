import {
  BulkGetDocUrlStatus,
  BulkGetDocumentsUrlProgress,
} from "../../../domain/medical/bulk-get-document-url";
import { Patient } from "../../../domain/medical/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type SetBulkGetDocUrlProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  successful?: number;
  errors?: number;
  status?: BulkGetDocUrlStatus;
  requestId?: string;
};

/**
 * The function `appendBulkGetDocUrlProgress` updates the progress of a BulkGetDocumentsUrl query to a patient's data.
 * @param {SetBulkGetDocUrlProgress}  - - A cmd argument type to update the progress of a bulk get doc url query.
 * @returns a Promise that resolves to a Patient object.
 */
export async function appendBulkGetDocUrlProgress({
  patient: { id, cxId },
  successful,
  errors,
  status,
  requestId,
}: SetBulkGetDocUrlProgress): Promise<Patient> {
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

    const BulkGetDocumentsUrlProgress = existingPatient.data?.bulkGetDocumentsUrlProgress || {};

    if (BulkGetDocumentsUrlProgress.urlGeneration) {
      // Updating only if the properties are not undefined
      if (successful) {
        BulkGetDocumentsUrlProgress.urlGeneration.successful = successful;
      }
      if (errors) {
        BulkGetDocumentsUrlProgress.urlGeneration.errors = errors;
      }
      // Ensure status is only assigned if not undefined
      if (status) {
        BulkGetDocumentsUrlProgress.urlGeneration.status = status;
      }
      if (requestId) {
        BulkGetDocumentsUrlProgress.requestId = requestId;
      }
    }

    const updatedPatient = {
      ...existingPatient,
      data: {
        ...existingPatient.data,
        BulkGetDocumentsUrlProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
    return updatedPatient;
  });
}

export type BulkGetDocUrlQueryInitCmd = BaseUpdateCmdWithCustomer & {
  bulkGetDocumentsUrlProgress: Required<Pick<BulkGetDocumentsUrlProgress, "urlGeneration">>;
  requestId: string;
  totalDocuments?: number;
};

/**
 * The function `storeBulkGetDocumentUrlQueryInit` initalizes the `BulkGetDocumentsUrlProgress`field in a patient's data.
 * @param {BulkGetDocUrlQueryInitCmd} cmd - The `cmd` argument type to initialize the `BulkGetDocumentsUrlProgress` field
 * @returns a Promise that resolves to a Patient object.
 */
export const storeBulkGetDocumentUrlQueryInit = async (
  cmd: BulkGetDocUrlQueryInitCmd
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
      bulkGetDocumentsUrlProgress: {
        ...cmd.bulkGetDocumentsUrlProgress,
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
