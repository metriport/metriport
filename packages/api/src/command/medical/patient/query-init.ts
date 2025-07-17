import { ConsolidatedQuery } from "@metriport/api-sdk";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "./get-patient";

export type InitConsolidatedQueryCmd = {
  consolidatedQuery: ConsolidatedQuery;
  cxConsolidatedRequestMetadata?: unknown;
  documentQueryProgress?: never;
};

export type InitDocumentQueryCmd = {
  documentQueryProgress: Required<
    Pick<DocumentQueryProgress, "download" | "requestId" | "startedAt">
  > &
    Pick<DocumentQueryProgress, "triggerConsolidated">;
  cxDocumentRequestMetadata?: unknown;
  consolidatedQuery?: never;
};
export type QueryInitCmd = InitConsolidatedQueryCmd | InitDocumentQueryCmd;

export type StoreQueryParams = {
  id: string;
  cxId: string;
  cmd: QueryInitCmd;
};

export async function storeQueryInit({ id, cxId, cmd }: StoreQueryParams): Promise<Patient> {
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    if (cmd.consolidatedQuery) {
      patient.dataValues.data.consolidatedQueries = appendProgressToProcessingQueries(
        patient.data.consolidatedQueries,
        cmd.consolidatedQuery
      );
    }

    return patient.update(
      {
        data: {
          ...patient.dataValues.data,
          ...(cmd.consolidatedQuery ? undefined : { ...cmd }),
        },
      },
      { transaction }
    );
  });
  return patient.dataValues;
}

function appendProgressToProcessingQueries(
  currentConsolidatedQueries: ConsolidatedQuery[] | undefined,
  progress: ConsolidatedQuery
): ConsolidatedQuery[] {
  if (currentConsolidatedQueries) {
    const queriesInProgress = currentConsolidatedQueries.filter(
      query => query.status === "processing"
    );

    return [...queriesInProgress, progress];
  }

  return [progress];
}
