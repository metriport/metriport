import { OrganizationModel, OrganizationData } from "../../../models/medical/organization";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationById } from "./get-organization";

export type OrganizationUpdateCmd = BaseUpdateCmdWithCustomer & OrganizationData;

/**
 * For E2E testing locally and staging.
 */
export const incrementOrganization = async (id: string): Promise<OrganizationModel> => {
  const org = await getOrganizationById(id);

  return org.update({
    organizationNumber: org.organizationNumber + 1,
  });
};
