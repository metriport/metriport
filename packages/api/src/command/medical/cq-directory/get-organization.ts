import { CQDirectoryEntry } from "../../../domain/medical/cq-directory";
import { CQDirectoryEntryModel } from "../../../models/medical/cq-directory";
import NotFoundError from "@metriport/core/util/error/not-found";

export const getCQOrganization = async ({
  oid,
}: Pick<CQDirectoryEntry, "oid">): Promise<CQDirectoryEntryModel | undefined> => {
  const org = await CQDirectoryEntryModel.findOne({
    where: { oid },
  });
  return org ?? undefined;
};

export const getCQOrganizationOrFail = async ({
  oid,
}: Pick<CQDirectoryEntry, "oid">): Promise<CQDirectoryEntryModel> => {
  const organization = await getCQOrganization({ oid });
  if (!organization) throw new NotFoundError(`Could not find cq organization`, undefined, { oid });
  return organization;
};
