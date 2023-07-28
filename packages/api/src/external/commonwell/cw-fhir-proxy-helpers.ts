import NotFoundError from "../../errors/not-found";
import { Organization, OrganizationModel } from "../../models/medical/organization";

// Didn't reuse getOrganizationOrFail bc we don't have `cxId` in this context and
// we want to keep that function requiring `cxId` to avoid cross-tenant data access
export async function getOrgOrFail(orgOID: string): Promise<Organization> {
  const org = await OrganizationModel.findOne({
    where: {
      oid: orgOID,
    },
  });
  if (!org) throw new NotFoundError(`Could not find organization with OID ${orgOID}`);
  return org;
}
