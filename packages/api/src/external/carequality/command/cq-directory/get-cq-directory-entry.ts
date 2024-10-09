import { NotFoundError } from "@metriport/shared";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export const getCQDirectoryEntry = async (
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntryModel | undefined> => {
  const org = await CQDirectoryEntryModel.findOne({
    where: { id },
  });
  return org ?? undefined;
};

export async function getCQDirectoryEntryOrFail(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntryModel> {
  const organization = await getCQDirectoryEntry(id);
  if (!organization) {
    throw new NotFoundError(`Could not find CQ organization`, undefined, { oid: id });
  }
  return organization;
}
