import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientDataCreate } from "../../cw-patient-data";
import { CwPatientDataModel } from "../../models/cw-patient-data";
import { getCwPatientDataOrFail } from "./get-cw-data";

export type CwPatientDataUpdate = CwPatientDataCreate & BaseUpdateCmdWithCustomer;

export async function updateCwPatientData(
  cwData: CwPatientDataUpdate
): Promise<CwPatientDataModel> {
  const { id, cxId } = cwData;
  return executeOnDBTx(CwPatientDataModel.prototype, async transaction => {
    const cwPatientData = await getCwPatientDataOrFail({
      id,
      cxId,
      transaction,
      lock: true,
    });

    return updateCwPatientDataWithinDBTx(cwData, cwPatientData, transaction);
  });
}

export async function updateCwPatientDataWithinDBTx(
  update: CwPatientDataUpdate,
  existing: CwPatientDataModel,
  transaction: Transaction
): Promise<CwPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...existing.data.links, ...newData.links];
  const uniqueUpdatedLinks = uniqBy(updatedLinks, function (nl) {
    return nl._links?.self?.href;
  });
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
