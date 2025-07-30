import { ConsolidatedQuery } from "@metriport/api-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "./get-patient";

export type StoreConsolidatedQueryInitialStateParams = {
  id: string;
  cxId: string;
  consolidatedQuery: ConsolidatedQuery;
  cxConsolidatedRequestMetadata?: unknown;
};

/**
 * Store the consolidated query initial state in the patient model.
 * It appends the consolidated query to the existing consolidated queries that are in progress.
 * It removes existing consolidated queries that are completed.
 *
 * @param params - The parameters for the consolidated query initial state.
 * @param params.id - The id of the patient.
 * @param params.cxId - The cx id of the patient.
 * @param params.consolidatedQuery - The consolidated query.
 * @param params.cxConsolidatedRequestMetadata - The cx consolidated request metadata.
 * @returns The updated patient.
 */
export async function storeConsolidatedQueryInitialState({
  id,
  cxId,
  consolidatedQuery,
  cxConsolidatedRequestMetadata,
}: StoreConsolidatedQueryInitialStateParams): Promise<Patient> {
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });
    const patientData = patient.dataValues.data;

    const consolidatedQueries = appendQueryToProcessingOnes(
      patientData.consolidatedQueries,
      consolidatedQuery
    );

    return patient.update(
      {
        data: {
          ...patientData,
          consolidatedQueries,
          cxConsolidatedRequestMetadata,
        },
      },
      { transaction }
    );
  });
  return patient.dataValues;
}

function appendQueryToProcessingOnes(
  existingConsolidatedQueries: ConsolidatedQuery[] | undefined,
  queryToAppend: ConsolidatedQuery
): ConsolidatedQuery[] {
  if (existingConsolidatedQueries) {
    const queriesInProgress = existingConsolidatedQueries.filter(
      query => query.status === "processing"
    );
    return [...queriesInProgress, queryToAppend];
  }
  return [queryToAppend];
}
