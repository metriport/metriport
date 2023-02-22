import NotFoundError from "../../../errors/not-found";
import { Organization } from "../../../models/medical/organization";

export const getOrganization = async ({ cxId }: { cxId: string }): Promise<Organization | null> => {
  const org = await Organization.findOne({
    where: { cxId },
  });
  return org;
};

export const getOrganizationOrFail = async ({ cxId }: { cxId: string }): Promise<Organization> => {
  const org = await Organization.findOne({
    where: { cxId },
  });
  if (!org) throw new NotFoundError(`Could not find organization for customer ${cxId}`);
  return org;
};
