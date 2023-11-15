import { DocumentQueryProgress } from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
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

  const patient = await getPatientOrFail({ id, cxId });

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

  return patient.update({
    data: {
      ...patient.data,
      ...update,
    },
  });
};
