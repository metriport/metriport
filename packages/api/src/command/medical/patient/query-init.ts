import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { QueryProgress, PatientDiscovery } from "@metriport/core/domain/query-status";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientOrFail } from "./get-patient";

type InitConsolidatedQueryCmd = {
  consolidatedQuery: QueryProgress;
  cxConsolidatedRequestMetadata?: unknown;
  documentQueryProgress?: never;
  patientDiscovery?: never;
};

type InitDocumentQueryCmd = {
  documentQueryProgress: Required<Pick<DocumentQueryProgress, "download">>;
  requestId: string;
  startedAt: Date;
  cxDocumentRequestMetadata?: unknown;
  consolidatedQuery?: never;
  patientDiscovery?: never;
};

type InitPatientDiscoveryCmd = {
  patientDiscovery: PatientDiscovery;
  documentQueryProgress?: never;
  consolidatedQuery?: never;
};

export type QueryInitCmd =
  | InitConsolidatedQueryCmd
  | InitDocumentQueryCmd
  | InitPatientDiscoveryCmd;

export const storeQueryInit = async ({
  id,
  cxId,
  cmd,
}: {
  id: string;
  cxId: string;
  cmd: QueryInitCmd;
}): Promise<Patient> => {
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
