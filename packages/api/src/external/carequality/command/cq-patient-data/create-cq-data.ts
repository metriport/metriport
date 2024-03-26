import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQLink, CQPatientData, CQPatientDataCreate } from "../../cq-patient-data";
import { CQPatientDataModel } from "../../models/cq-patient-data";
import { getCQPatientData } from "./get-cq-data";
import { updateCQPatientDataWithinDBTx } from "./update-cq-data";

export async function createOrUpdateCQPatientData({
  id,
  cxId,
  cqLinks,
}: {
  id: string;
  cxId: string;
  cqLinks: CQLink[];
}): Promise<CQPatientData | undefined> {
  const cqPatientData: CQPatientDataCreate = {
    id,
    cxId,
    data: { links: cqLinks },
  };

  const updateResult = await executeOnDBTx(CQPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCQPatientData({
      id,
      cxId,
      transaction,
    });
    if (!existingPatient) return undefined;
    return updateCQPatientDataWithinDBTx(cqPatientData, existingPatient, transaction);
  });
  if (updateResult) return updateResult;

  if (!cqLinks.length) return undefined;
  return await CQPatientDataModel.create(cqPatientData);
}
