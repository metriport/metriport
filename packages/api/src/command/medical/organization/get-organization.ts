import NotFoundError from "../../../errors/not-found";
import { OrganizationModel } from "../../../models/medical/organization";

type Filter = Pick<OrganizationModel, "cxId"> & Partial<Pick<OrganizationModel, "id">>;

export const getOrganization = async ({
  cxId,
  id,
}: Filter): Promise<OrganizationModel | undefined> => {
  const org = await OrganizationModel.findOne({
    where: { cxId, ...(id ? { id } : undefined) },
  });
  return org ?? undefined;
};

export const getOrganizationOrFail = async (filter: Filter): Promise<OrganizationModel> => {
  const org = await getOrganization(filter);
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
};
