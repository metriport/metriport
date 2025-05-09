import { Config } from "../../../shared/config";
import { OrganizationModel } from "../../../models/medical/organization";
import { makeOrganizationOID } from "../../../shared/oid";

// Adds a configurable offset which defaults to zero
export async function createOrganizationId(): Promise<{ oid: string; organizationNumber: number }> {
  const maxOrgNumber =
    Number(await OrganizationModel.max("organizationNumber")) + Config.getSystemRootOrgOffset();
  const organizationNumber = maxOrgNumber + 1;
  const oid = makeOrganizationOID(organizationNumber);
  return { oid, organizationNumber };
}
