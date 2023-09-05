import { OrganizationModel, OrganizationData } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail, getOrganizationById } from "./get-organization";

export type OrganizationUpdateCmd = BaseUpdateCmdWithCustomer & OrganizationData;

export const updateOrganization = async (
  orgUpdate: OrganizationUpdateCmd
): Promise<OrganizationModel> => {
  const { id, cxId, eTag, name, type, location } = orgUpdate;

  const org = await getOrganizationOrFail({ id, cxId });
  validateVersionForUpdate(org, eTag);

  return org.update({
    data: {
      name,
      type,
      location,
    },
  });
};

/**
 * For E2E testing locally and staging.
 */
export const incrementOrganization = async (id: string): Promise<OrganizationModel> => {
  const org = await getOrganizationById(id);

  return org.update({
    organizationNumber: org.organizationNumber + 1,
  });
};
