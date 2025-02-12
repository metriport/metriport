import { Transaction } from "sequelize";
import NotFoundError from "@metriport/core/util/error/not-found";
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

export async function getInvalidLinksOrFail({
  id,
  cxId,
  transaction,
  lock = false,
}: GetInvalidLinks): Promise<InvalidLinksModel> {
  const invalidLinks = await getInvalidLinks({ id, cxId, transaction, lock });
  if (!invalidLinks) {
    throw new NotFoundError(`Invalid links not found for id: ${id}`);
  }
  return invalidLinks;
}
