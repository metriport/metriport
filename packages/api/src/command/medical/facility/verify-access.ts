import { OrganizationBizType } from "@metriport/core/domain/organization";
import ForbiddenError from "../../../errors/forbidden";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function verifyCxItVendorAccess(
  cxId: string,
  throwOnNoAccess = true
): Promise<boolean> {
  const org = await getOrganizationOrFail({ cxId });
  if (org.type === OrganizationBizType.healthcareProvider) {
    if (throwOnNoAccess) {
      throw new ForbiddenError("Facilities cannot be created or updated, contact support.");
    }
    return false;
  }
  return true;
}

export async function verifyCxProviderAccess(
  cxId: string,
  throwOnNoAccess = true
): Promise<boolean> {
  const org = await getOrganizationOrFail({ cxId });
  if (org.type === OrganizationBizType.healthcareITVendor) {
    if (throwOnNoAccess) {
      throw new ForbiddenError("Facilities cannot be created or updated, contact support.");
    }
    return false;
  }
  return true;
}
