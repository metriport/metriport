import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQPatientDataCreate } from "../../cq-patient-data";
import { CQPatientDataModel } from "../../models/cq-patient-data";
import { getCQPatientDataOrFail } from "./get-cq-data";

export type CQPatientDataUpdate = CQPatientDataCreate & BaseUpdateCmdWithCustomer;

export async function updateCQPatientData(
  cqData: CQPatientDataUpdate
): Promise<CQPatientDataModel> {
  const { id, cxId } = cqData;
  return executeOnDBTx(CQPatientDataModel.prototype, async transaction => {
    const cqPatientData = await getCQPatientDataOrFail({
      id,
      cxId,
      transaction,
      lock: true,
    });

    return updateCQPatientDataWithinDBTx(cqData, cqPatientData, transaction);
  });
}

export async function updateCQPatientDataWithinDBTx(
  update: CQPatientDataUpdate,
  existing: CQPatientDataModel,
  transaction: Transaction
): Promise<CQPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...existing.data.links, ...newData.links];
  const uniqueUpdatedLinks = uniqBy(updatedLinks, "oid");
  const updatedLinkDemographicsHistory = {
    ...existing.data.linkDemographicsHistory,
    ...newData.linkDemographicsHistory,
  };
  return existing.update(
    {
      data: {
        ...existing.data,
        ...newData,
        links: uniqueUpdatedLinks,
        ...(newData.linkDemographicsHistory && {
          linkDemographicsHistory: updatedLinkDemographicsHistory,
        }),
      },
    },
    { transaction }
  );
}
