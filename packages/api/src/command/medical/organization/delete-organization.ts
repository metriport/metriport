import { OrganizationModel } from "../../../models/medical/organization";

type Filter = Pick<OrganizationModel, "cxId"> & Partial<Pick<OrganizationModel, "id">>;

/**
 * For E2E testing locally and staging.
 */
export const deleteOrganization = async ({ cxId, id }: Filter): Promise<void> => {
  await OrganizationModel.destroy({
    where: { cxId, ...(id ? { id } : undefined) },
  });
};
