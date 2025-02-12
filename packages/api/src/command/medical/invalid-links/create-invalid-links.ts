import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { InvalidLinksData } from "../../../domain/invalid-links";
import { InvalidLinks } from "../../../domain/invalid-links";
import { InvalidLinksCreate } from "../../../domain/invalid-links";
import { InvalidLinksModel } from "../../../models/invalid-links";
import { getInvalidLinks } from "./get-invalid-links";
import { updateInvalidLinksWithinDbTx } from "./update-invalid-links";

export async function createOrUpdateInvalidLinks({
  id,
  cxId,
  invalidLinks,
}: {
  id: string;
  cxId: string;
  invalidLinks: InvalidLinksData;
}): Promise<InvalidLinks> {
  const invalidLinksCreate: InvalidLinksCreate = {
    id,
    cxId,
    data: invalidLinks,
  };

  const updateResult = await executeOnDBTx(InvalidLinksModel.prototype, async transaction => {
    const existingInvalidLinks = await getInvalidLinks({
      id,
      cxId,
      transaction,
      lock: true,
    });
    if (!existingInvalidLinks) return undefined;
    return updateInvalidLinksWithinDbTx(invalidLinksCreate, existingInvalidLinks, transaction);
  });
  if (updateResult) return updateResult;

  const invalidLinksResult = await InvalidLinksModel.create(invalidLinksCreate);

  return invalidLinksResult.dataValues;
}
