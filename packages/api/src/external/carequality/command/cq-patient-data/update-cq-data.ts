import { uniqBy } from "lodash";
import { CQPatientDataCreate } from "../../domain/cq-patient-data";
import { CQPatientDataModel } from "../../../../models/medical/cq-patient-data";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { getCQPatientDataOrFail } from "./get-cq-data";

export type CQPatientDataUpdate = CQPatientDataCreate & BaseUpdateCmdWithCustomer;

export async function updateCQPatientData(cqData: CQPatientDataUpdate) {
  const { id, cxId } = cqData;

  return executeOnDBTx(CQPatientDataModel.prototype, async transaction => {
    const cqPatientData = await getCQPatientDataOrFail({
      id,
      cxId,
    });

    const updatedLinks = [...cqPatientData.data.links, ...cqData.data.links];
    const uniqueLinks = uniqBy(updatedLinks, "oid");

    return cqPatientData.update(
      {
        data: {
          links: uniqueLinks,
        },
      },
      { transaction }
    );
  });
}
