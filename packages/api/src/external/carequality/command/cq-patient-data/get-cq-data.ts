import NotFoundError from "@metriport/core/util/error/not-found";
import { Transaction } from "sequelize";
import { CQPatientDataModel } from "../../models/cq-patient-data";

export type GetCQData = { id: string; cxId: string; transaction?: Transaction; lock?: boolean };

export async function getCQPatientData({
  id,
  cxId,
  transaction,
  lock = false,
}: GetCQData): Promise<CQPatientDataModel | undefined> {
  const cqPatientData = await CQPatientDataModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return cqPatientData ?? undefined;
}

export async function getCQPatientDataOrFail(params: GetCQData): Promise<CQPatientDataModel> {
  const cqPatientData = await getCQPatientData(params);
  if (!cqPatientData) {
    throw new NotFoundError(`Could not find patient's CQ data`, undefined, {
      id: params.id,
      cxId: params.cxId,
    });
  }
  return cqPatientData;
}
