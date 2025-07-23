import { ConsolidatedQuery } from "@metriport/api-sdk";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "./get-patient";

export type InitConsolidatedQueryCmd = {
  consolidatedQueries: ConsolidatedQuery[];
  cxConsolidatedRequestMetadata?: unknown;
  documentQueryProgress?: never;
  patientDiscovery?: never;
};

export type InitDocumentQueryCmd = {
  documentQueryProgress: Required<
    Pick<DocumentQueryProgress, "download" | "requestId" | "startedAt">
  > &
    Pick<DocumentQueryProgress, "triggerConsolidated">;
  cxDocumentRequestMetadata?: unknown;
  consolidatedQueries?: never;
  patientDiscovery?: never;
};
export type QueryInitCmd = InitConsolidatedQueryCmd | InitDocumentQueryCmd;

export type StoreQueryParams = {
  id: string;
  cxId: string;
  cmd: QueryInitCmd;
};

/**
 * TODO ENG-477 remove this asap
 * @deprecated This is the culprit of ENG-477
 */
export async function storeQueryInit({ id, cxId, cmd }: StoreQueryParams): Promise<Patient> {
  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    return patient.update(
      {
        data: {
          ...patient.dataValues.data,
          ...cmd,
        },
      },
      { transaction }
    );
  });
  return patient.dataValues;
}
