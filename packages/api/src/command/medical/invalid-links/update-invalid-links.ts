import { Transaction } from "sequelize";
import { uniqBy } from "lodash";
import { BaseUpdateCmdWithCustomer } from "../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { InvalidLinksData } from "../../../domain/invalid-links";
import { InvalidLinks } from "../../../domain/invalid-links";
import { InvalidLinksCreate } from "../../../domain/invalid-links";
import { InvalidLinksModel } from "../../../models/invalid-links";
import { getInvalidLinksOrFail } from "./get-invalid-links";

export type InvalidLinksUpdate = InvalidLinksCreate & BaseUpdateCmdWithCustomer;

export async function updateInvalidLinks({
  id,
  cxId,
  invalidLinks,
}: {
  id: string;
  cxId: string;
  invalidLinks?: InvalidLinksData;
}): Promise<InvalidLinks> {
  const invalidLinksUpdate: InvalidLinksUpdate = {
    id,
    cxId,
    data: invalidLinks ?? {},
  };

  const updateResult = await executeOnDBTx(InvalidLinksModel.prototype, async transaction => {
    const existingInvalidLinks = await getInvalidLinksOrFail({ id, cxId, transaction, lock: true });

    return updateInvalidLinksWithinDBTx(invalidLinksUpdate, existingInvalidLinks, transaction);
  });
  return updateResult.dataValues;
}

export async function updateInvalidLinksWithinDBTx(
  update: InvalidLinksUpdate,
  existing: InvalidLinksModel,
  transaction: Transaction
): Promise<InvalidLinksModel> {
  const { data: newData } = update;

  const updatedData = {
    carequality: [...(existing.data.carequality ?? []), ...(newData.carequality ?? [])],
    commonwell: [...(existing.data.commonwell ?? []), ...(newData.commonwell ?? [])],
  };

  const uniqueUpdatedData = {
    carequality: uniqBy(updatedData.carequality, "oid"),
    commonwell: uniqBy(updatedData.commonwell, function (nl) {
      return nl.patient?.provider?.reference;
    }),
  };

  return existing.update(
    {
      data: uniqueUpdatedData,
    },
    { transaction }
  );
}
