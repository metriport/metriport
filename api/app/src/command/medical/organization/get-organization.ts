import NotFoundError from "../../../errors/not-found";
import { Organization } from "../../../models/medical/organization";

type Filter = Pick<Organization, "cxId"> & Partial<Pick<Organization, "id">>;

export const getOrganization = async ({ cxId, id }: Filter): Promise<Organization | null> => {
  const org = await Organization.findOne({
    where: { cxId, ...(id ? { id } : undefined) },
  });
  return org;
};

export const getOrganizationOrFail = async (filter: Filter): Promise<Organization> => {
  const org = await getOrganization(filter);
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
};
