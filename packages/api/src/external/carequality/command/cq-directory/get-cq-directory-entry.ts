import { NotFoundError } from "@metriport/shared/error/not-found";
import { CQDirectoryEntry } from "../../cq-directory";
import { CQDirectoryEntryModel } from "../../models/cq-directory";

export async function getCQDirectoryEntry(
  id: CQDirectoryEntry["id"]
): Promise<CQDirectoryEntry | undefined> {
  const org = await CQDirectoryEntryModel.findOne({
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
