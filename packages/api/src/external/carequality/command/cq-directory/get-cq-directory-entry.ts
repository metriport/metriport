import { NotFoundError } from "@metriport/shared";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryViewModel } from "../../models/cq-directory-view";

export async function getCQDirectoryEntry(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry | undefined> {
  const org = await CQDirectoryEntryViewModel.findOne({
    where: { id },
  });
  return org?.dataValues ?? undefined;
}

export async function getCQDirectoryEntryOrFail(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry> {
  const organization = await getCQDirectoryEntry(id);
  if (!organization) {
    throw new NotFoundError(`Could not find CQ organization`, undefined, { oid: id });
  }
  return organization;
}
