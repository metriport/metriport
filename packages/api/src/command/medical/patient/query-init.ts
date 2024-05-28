import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { ConsolidatedQueryByRequestId } from "@metriport/core/domain/query-status";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

export type InitConsolidatedQueryCmd = {
  consolidatedQuery: ConsolidatedQueryByRequestId;
  cxConsolidatedRequestMetadata?: unknown;
  documentQueryProgress?: never;
  patientDiscovery?: never;
};

export type InitDocumentQueryCmd = {
  documentQueryProgress: Required<
    Pick<DocumentQueryProgress, "download" | "requestId" | "startedAt">
  >;
  cxDocumentRequestMetadata?: unknown;
  consolidatedQuery?: never;
  patientDiscovery?: never;
};
export type QueryInitCmd = InitConsolidatedQueryCmd | InitDocumentQueryCmd;

export type StoreQueryParams = {
  id: string;
  cxId: string;
  cmd: QueryInitCmd;
};

export const storeQueryInit = async ({ id, cxId, cmd }: StoreQueryParams): Promise<Patient> => {
  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    return patient.update(
      {
        data: {
          ...patient.data,
          ...cmd,
        },
      },
      { transaction }
    );
  });
};
