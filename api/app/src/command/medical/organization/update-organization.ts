import { Organization, OrganizationData } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { getOrganizationOrFail } from "./get-organization";

export type OrganizationUpdateCmd = Pick<Organization, "id" | "cxId" | "eTag"> & OrganizationData;

export const updateOrganization = async (
  orgUpdate: OrganizationUpdateCmd
): Promise<Organization> => {
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
