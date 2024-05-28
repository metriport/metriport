import { NetworkLink } from "@metriport/commonwell-sdk";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientData, CwPatientDataCreate } from "../../cw-patient-data";
import { CwPatientDataModel } from "../../models/cw-patient-data";
import { getCwPatientData } from "./get-cw-data";
import { updateCwPatientDataWithinDBTx } from "./update-cw-data";

export async function createOrUpdateCwPatientData({
  id,
  cxId,
  cwLinks,
}: {
  id: string;
  cxId: string;
  cwLinks: NetworkLink[];
}): Promise<CwPatientData | undefined> {
  const cwPatientData: CwPatientDataCreate = {
    id,
    cxId,
    data: { links: cwLinks },
  };

  const updateResult = await executeOnDBTx(CwPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCwPatientData({
      id,
      cxId,
      transaction,
    });
    if (!existingPatient) return undefined;
    return updateCwPatientDataWithinDBTx(cwPatientData, existingPatient, transaction);
  });
  if (updateResult) return updateResult;

  if (!cwLinks.length) return undefined;
  return await CwPatientDataModel.create(cwPatientData);
}
