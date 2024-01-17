import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { Patient } from "@metriport/core/domain/patient";
import { QueryProgress } from "@metriport/core/domain/query-status";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientOrFail } from "./get-patient";

export type QueryInitCmd = BaseUpdateCmdWithCustomer &
  (
    | {
        documentQueryProgress: Required<Pick<DocumentQueryProgress, "download">>;
        requestId: string;
        cxDocumentRequestMetadata?: unknown;
      }
    | {
        documentQueryProgress?: never;
        consolidatedQuery: QueryProgress;
        cxConsolidatedRequestMetadata?: unknown;
      }
  );

export const storeQueryInit = async (cmd: QueryInitCmd): Promise<Patient> => {
  const { id, cxId } = cmd;

  return executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    const update = cmd.documentQueryProgress
      ? {
          documentQueryProgress: cmd.documentQueryProgress,
          requestId: cmd.requestId,
          cxDocumentRequestMetadata: cmd.cxDocumentRequestMetadata,
        }
      : {
          consolidatedQuery: cmd.consolidatedQuery,
          cxConsolidatedRequestMetadata: cmd.cxConsolidatedRequestMetadata,
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
