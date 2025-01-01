import {
  BulkGetDocUrlStatus,
  BulkGetDocumentsUrlProgress,
} from "@metriport/core/domain/bulk-get-document-url";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type SetBulkGetDocUrlProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  status?: BulkGetDocUrlStatus;
  requestId?: string;
};

/**
 * The function `appendBulkGetDocUrlProgress` updates the progress of a BulkGetDocumentsUrl query to a patient's data.
 * @param SetBulkGetDocUrlProgress - A cmd argument type to update the progress of a bulk get doc URL query.
 * @returns a Promise that resolves to a Patient object.
 */
export async function appendBulkGetDocUrlProgress({
  patient: { id, cxId },
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

    const bulkGetDocumentsUrlProgress: BulkGetDocumentsUrlProgress = existingPatient.data
      ?.bulkGetDocumentsUrlProgress || { status: "processing" };

    if (status) {
      bulkGetDocumentsUrlProgress.status = status;
    }
    if (requestId) {
      bulkGetDocumentsUrlProgress.requestId = requestId;
    }

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        bulkGetDocumentsUrlProgress,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
    return updatedPatient;
  });
}

export type BulkGetDocUrlQueryInitCmd = BaseUpdateCmdWithCustomer & {
  bulkGetDocumentsUrlProgress: Required<Pick<BulkGetDocumentsUrlProgress, "status">>;
  requestId: string;
  cxDownloadRequestMetadata?: unknown;
};

/**
 * The function `storeBulkGetDocumentUrlQueryInit` initializes the `BulkGetDocumentsUrlProgress` field in a patient's data.
 * @param cmd - The `cmd` argument type to initialize the `BulkGetDocumentsUrlProgress` field
 * @returns a Promise that resolves to a Patient object.
 */
export const storeBulkGetDocumentUrlQueryInit = async (
  cmd: BulkGetDocUrlQueryInitCmd
): Promise<Patient> => {
  const { id, cxId } = cmd;

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    const update = {
      bulkGetDocumentsUrlProgress: {
        ...patient.data.bulkGetDocumentsUrlProgress,
        ...cmd.bulkGetDocumentsUrlProgress,
        requestId: cmd.requestId,
      },
      cxDownloadRequestMetadata: cmd.cxDownloadRequestMetadata,
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
