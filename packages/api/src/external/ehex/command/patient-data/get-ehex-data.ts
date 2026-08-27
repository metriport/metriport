import { NotFoundError } from "@metriport/shared";
import { Transaction } from "sequelize";
import { EhexPatientData } from "../../ehex-patient-data";
import { EhexPatientDataModel } from "../../models/ehex-patient-data";

export type GetEhexData = { id: string; cxId: string; transaction?: Transaction; lock?: boolean };

export async function getEhexPatientDataModel({
  id,
  cxId,
  transaction,
  lock = false,
}: GetEhexData): Promise<EhexPatientDataModel | undefined> {
  const ehexPatientData = await EhexPatientDataModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return ehexPatientData ?? undefined;
}

export async function getEhexPatientDataModelOrFail(
  params: GetEhexData
): Promise<EhexPatientDataModel> {
  const ehexPatientData = await getEhexPatientDataModel(params);
  if (!ehexPatientData) {
    throw new NotFoundError(`Could not find patient's Ehex data`, undefined, {
      id: params.id,
      cxId: params.cxId,
    });
  }
  return ehexPatientData;
}

export async function getEhexPatientData({
  id,
  cxId,
  transaction,
  lock = false,
}: GetEhexData): Promise<EhexPatientData | undefined> {
  const ehexPatientData = await getEhexPatientDataModel({ id, cxId, transaction, lock });
  return ehexPatientData?.dataValues ?? undefined;
}

export async function getEhexPatientDataOrFail(params: GetEhexData): Promise<EhexPatientData> {
  const ehexPatientData = await getEhexPatientData(params);
  if (!ehexPatientData) {
    throw new NotFoundError(`Could not find patient's Ehex data`, undefined, {
      id: params.id,
      cxId: params.cxId,
    });
  }
  return ehexPatientData;
}
