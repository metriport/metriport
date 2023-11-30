import NotFoundError from "@metriport/core/util/error/not-found";
import { CQDirectoryEntry } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";

export const getCQDirectoryEntry = async ({
  oid,
}: Pick<CQDirectoryEntry, "oid">): Promise<CQDirectoryEntryModel | undefined> => {
  const org = await CQDirectoryEntryModel.findOne({
    where: { oid },
  });
  return org ?? undefined;
};

export const getCQDirectoryEntryOrFail = async ({
  oid,
}: Pick<CQDirectoryEntry, "oid">): Promise<CQDirectoryEntryModel> => {
  const organization = await getCQDirectoryEntry({ oid });
  if (!organization) throw new NotFoundError(`Could not find CQ organization`, undefined, { oid });
  return organization;
};

export const getCQDirectoryEntriesByOids = async (oids: string[]): Promise<CQDirectoryEntry[]> => {
  try {
    const entries = await CQDirectoryEntryModel.findAll({
      where: {
        oid: oids,
      },
    });
    return entries;
  } catch (error) {
    console.error("Error fetching CQDirectoryEntries by OIDs:", error);
    throw error;
  }
};

export const getAllCQDirectoryEntries = async (): Promise<CQDirectoryEntryModel[]> => {
  return await CQDirectoryEntryModel.findAll();
};
