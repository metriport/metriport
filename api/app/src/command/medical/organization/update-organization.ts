import { Organization, OrganizationData } from "../../../models/medical/organization";
import { validateVersionForUpdate } from "../../../models/_default";
import { getOrganizationOrFail } from "./get-organization";

export type OrganizationUpdateCmd = Pick<Organization, "id" | "cxId"> &
  Partial<Pick<Organization, "version">> &
  OrganizationData;

export const updateOrganization = async (
  orgUpdate: OrganizationUpdateCmd
): Promise<Organization> => {
  const { id, cxId, version, name, type, location } = orgUpdate;

  const org = await getOrganizationOrFail({ id, cxId });
  validateVersionForUpdate(org, version);

  return org.update({
    data: {
      name,
      type,
      location,
    },
  });
};
