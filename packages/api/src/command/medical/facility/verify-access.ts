import { OrganizationType } from "@metriport/core/domain/organization";
import ForbiddenError from "../../../errors/forbidden";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function verifyCxAccess(cxId: string, throwOnNoAccess = true): Promise<boolean> {
  const org = await getOrganizationOrFail({ cxId });
  if (org.type === OrganizationType.healthcareITVendor) {
    if (throwOnNoAccess) {
      throw new ForbiddenError("Facilities cannot be created or updated, contact support.");
    }
    return false;
  }
  return true;
}
