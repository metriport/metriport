import { OrganizationModel } from "../../../models/medical/organization";

type Filter = Pick<OrganizationModel, "cxId"> & Partial<Pick<OrganizationModel, "id">>;

export const deleteOrganization = async ({ cxId, id }: Filter): Promise<void> => {
  await OrganizationModel.destroy({
    where: { cxId, ...(id ? { id } : undefined) },
  });
};
