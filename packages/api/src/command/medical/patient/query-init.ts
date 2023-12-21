import { cloneDeep } from "lodash";
import { DocumentQueryProgress } from "../../../domain/medical/document-query";
import { Patient } from "../../../domain/medical/patient";
import { QueryProgress } from "../../../domain/medical/query-status";
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

    const updatedData = cloneDeep(patient.data);

    if (cmd.documentQueryProgress) {
      updatedData.documentQueryProgress = cmd.documentQueryProgress;
      updatedData.requestId = cmd.requestId;
      updatedData.cxDocumentRequestMetadata = cmd.cxDocumentRequestMetadata;
      updatedData.externalData = {
        ...updatedData.externalData,
        COMMONWELL: {
          ...updatedData.externalData?.COMMONWELL,
          documentQueryProgress: cmd.documentQueryProgress,
        },
        CAREQUALITY: {
          ...updatedData.externalData?.CAREQUALITY,
          documentQueryProgress: cmd.documentQueryProgress,
        },
      };
    } else {
      updatedData.consolidatedQuery = cmd.consolidatedQuery;
      updatedData.cxConsolidatedRequestMetadata = cmd.cxConsolidatedRequestMetadata;
    }

    return patient.update(
      {
        data: updatedData,
      },
      { transaction }
    );
  });
};
