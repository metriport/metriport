import NotFoundError from "../../../errors/not-found";
import { OrganizationModel } from "../../../models/medical/organization";

/**
 * For E2E testing locally and staging.
 * Need to get specific org to increment org number.
 */
export const getOrganizationById = async (id: string): Promise<OrganizationModel> => {
  const org = await OrganizationModel.findOne({
    where: { id },
  });
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
};
