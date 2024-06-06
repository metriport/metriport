import { Patient } from "@metriport/core/domain/patient";
import { ConsolidatedQuery } from "@metriport/api-sdk";
import { capture } from "@metriport/core/util/notifications";
import { QueryProgress } from "@metriport/core/domain/query-status";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export type SetDocQueryProgress = {
  patient: Pick<Patient, "id" | "cxId">;
  requestId: string;
  progress: QueryProgress;
};

/**
 * Update a single patient's consolidated query progress.
 * Keeps existing sibling properties when those are not provided
 * @returns the updated Patient
 */
export async function updateConsolidatedQueryProgress({
  patient,
  requestId,
  progress,
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

    const consolidatedQueries = generateUpdateConsolidatedProgress(
      patient.data.consolidatedQueries,
      progress,
      requestId
    );

    const updatedPatient = {
      ...patient.dataValues,
      data: {
        ...patient.data,
        consolidatedQueries,
      },
    };

    await PatientModel.update(updatedPatient, { where: patientFilter, transaction });
  });
}

function generateUpdateConsolidatedProgress(
  consolidatedQueries: ConsolidatedQuery[] | undefined,
  updatedProgress: QueryProgress,
  requestId: string
): ConsolidatedQuery[] {
  if (!consolidatedQueries) {
    const msg = `No consolidated queries found`;
    console.log(`${msg} requestId: ${requestId}`);
    capture.message(msg, {
      extra: {
        context: "generateUpdateConsolidatedProgress",
        requestId,
        updatedProgress,
      },
      level: "warning",
    });

    return [];
  }

  return consolidatedQueries.map(query => {
    if (query.requestId === requestId) {
      return {
        ...query,
        status: updatedProgress.status,
      };
    }
    return query;
  });
}
