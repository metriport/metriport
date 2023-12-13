import NotFoundError from "@metriport/core/util/error/not-found";
import { CQDirectoryEntry } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";

export const getCQDirectoryEntry = async (
  id: Pick<CQDirectoryEntry, "id">
): Promise<CQDirectoryEntryModel | undefined> => {
  const org = await CQDirectoryEntryModel.findOne({
    where: { id },
  });
  return org ?? undefined;
};

export async function getCQDirectoryEntryOrFail(
  id: Pick<CQDirectoryEntry, "id">
): Promise<CQDirectoryEntryModel> {
  const organization = await getCQDirectoryEntry(id);
  if (!organization) throw new NotFoundError(`Could not find CQ organization`, undefined, id);
  return organization;
}
