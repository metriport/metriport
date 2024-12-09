import { NotFoundError } from "@metriport/shared";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export const getCQDirectoryEntry = async (
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry | undefined> => {
  const organization = await CQDirectoryEntryModel.findOne({
    where: { id },
  });
  if (!organization) return undefined;
  return organization.dataValues;
};

export async function getCQDirectoryEntryOrFail(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry> {
  const organization = await getCQDirectoryEntry(id);
  if (!organization) {
    throw new NotFoundError(`CQ Directory Entry not found`, undefined, { id });
  }
  return organization;
}
