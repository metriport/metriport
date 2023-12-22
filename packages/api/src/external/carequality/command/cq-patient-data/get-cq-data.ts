import NotFoundError from "../../../../errors/not-found";
import { CQPatientDataModel } from "../../models/cq-patient-data";

export type GetCQData = { id: string; cxId: string };

export async function getCQPatientData({
  id,
  cxId,
}: GetCQData): Promise<CQPatientDataModel | undefined> {
  const cqPatientData = await CQPatientDataModel.findOne({
    where: { cxId, id },
  });
  return cqPatientData ?? undefined;
}

export async function getCQPatientDataOrFail(params: GetCQData): Promise<CQPatientDataModel> {
  const cqPatientData = await getCQPatientData(params);
  if (!cqPatientData)
    throw new NotFoundError(`Could not find patient's CQ data`, undefined, { id: params.id });
  return cqPatientData;
}
