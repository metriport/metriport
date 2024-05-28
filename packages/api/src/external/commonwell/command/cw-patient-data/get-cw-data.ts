import NotFoundError from "@metriport/core/util/error/not-found";
import { Transaction } from "sequelize";
import { CwPatientDataModel } from "../../models/cw-patient-data";

export type GetCwData = { id: string; cxId: string; transaction?: Transaction };

export async function getCwPatientData({
  id,
  cxId,
  transaction,
}: GetCwData): Promise<CwPatientDataModel | undefined> {
  const cwPatientData = await CwPatientDataModel.findOne({
    where: { cxId, id },
    transaction,
  });
  return cwPatientData ?? undefined;
}

export async function getCwPatientDataOrFail(params: GetCwData): Promise<CwPatientDataModel> {
  const cwPatientData = await getCwPatientData(params);
  if (!cwPatientData) {
    throw new NotFoundError(`Could not find patient's CW data`, undefined, {
      id: params.id,
      cxId: params.cxId,
    });
  }
  return cwPatientData;
}
