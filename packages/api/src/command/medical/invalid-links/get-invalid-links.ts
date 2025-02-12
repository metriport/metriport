import { Transaction } from "sequelize";
import { InvalidLinksModel } from "../../../models/invalid-links";

export type GetInvalidLinks = {
  id: string;
  cxId: string;
  transaction?: Transaction;
  lock?: boolean;
};

export async function getInvalidLinks({
  id,
  cxId,
  transaction,
  lock = false,
}: GetInvalidLinks): Promise<InvalidLinksModel | undefined> {
  const invalidLinks = await InvalidLinksModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return invalidLinks ?? undefined;
}
