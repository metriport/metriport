import { ConsolidatedQuery } from "@metriport/api-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "./get-patient";

export type InitConsolidatedQueryCmd = {
  consolidatedQueries: ConsolidatedQuery[];
  cxConsolidatedRequestMetadata?: unknown;
  patientDiscovery?: never;
};

export type InitDocumentQueryCmd = {
  cxDocumentRequestMetadata?: unknown;
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
