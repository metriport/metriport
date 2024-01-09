import { OrganizationData } from "@metriport/core/domain/organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getOrganizationOrFail } from "./get-organization";

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
