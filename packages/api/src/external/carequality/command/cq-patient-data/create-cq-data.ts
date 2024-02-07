import { CQLink, CQPatientData, CQPatientDataCreate } from "../../cq-patient-data";
import { CQPatientDataModel } from "../../models/cq-patient-data";
import { getCQPatientData } from "./get-cq-data";
import { updateCQPatientData } from "./update-cq-data";

export async function createOrUpdateCQPatientData({
  id,
  cxId,
  cqLinks,
}: {
  id: string;
  cxId: string;
  cqLinks: CQLink[];
}): Promise<CQPatientData | undefined> {
  if (!cqLinks.length) return;
  const cqPatientData: CQPatientDataCreate = {
    id,
    cxId,
    data: { links: cqLinks },
  };

  const existingCQPatientData = await getCQPatientData({ id, cxId });
  if (existingCQPatientData) return updateCQPatientData(cqPatientData);

  return await CQPatientDataModel.create(cqPatientData);
}

export async function createCQData(cqData: CQPatientDataCreate): Promise<CQPatientData> {
  return await CQPatientDataModel.create(cqData);
}
