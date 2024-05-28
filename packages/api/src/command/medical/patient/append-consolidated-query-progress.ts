import { Patient } from "@metriport/core/domain/patient";
import { QueryProgress } from "@metriport/core/domain/query-status";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  requestId: string;
  progress: QueryProgress;
  reset?: boolean;
};

/**
 * Update a patient's consolidated query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns the updated Patient
 */
export async function updateConsolidatedQueryProgress({
  patient,
  requestId,
  progress,
  reset,
}: SetDocQueryProgress): Promise<void> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const consolidatedQuery = reset
      ? {
          [requestId]: progress,
        }
      : {
          ...patient.data.consolidatedQuery,
          [requestId]: {
            ...patient.data.consolidatedQuery?.[requestId],
            ...progress,
          },
        };

    const updatedPatient = {
      ...patient.dataValues,
      data: {
        ...patient.data,
        consolidatedQuery,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
  });
}
