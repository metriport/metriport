import NotFoundError from "../../errors/not-found";
import { Organization, OrganizationModel } from "../../models/medical/organization";

// Didn't reuse getOrganizationOrFail bc we don't have `cxId` in this context and
// we want to keep that function requiring `cxId` to avoid cross-tenant data access
export async function getOrgOrFail(orgId: string): Promise<Organization> {
  const org = await OrganizationModel.findByPk(orgId);
  if (!org) throw new NotFoundError(`Could not find organization ${orgId}`);
  return org;
}
