import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  progress: QueryProgress;
  reset?: boolean;
  cxConsolidatedRequestMetadata?: unknown;
};

/**
 * Update a patient's consolidated query progress.
 * Keeps existing sibling properties when those are not provided, unless
 * 'reset=true' is provided.
 * @returns the updated Patient
 */
export async function updateConsolidatedQueryProgress({
  patient,
  progress,
  reset,
  cxConsolidatedRequestMetadata,
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
      ? progress
      : {
          ...patient.data.consolidatedQuery,
          ...progress,
        };

    const updatedPatient = {
      ...patient,
      data: {
        ...patient.data,
        consolidatedQuery,
        cxConsolidatedRequestMetadata:
          cxConsolidatedRequestMetadata !== undefined
            ? (cxConsolidatedRequestMetadata as Record<string, string>)
            : patient.data.cxConsolidatedRequestMetadata,
      },
    };
    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
  });
}
