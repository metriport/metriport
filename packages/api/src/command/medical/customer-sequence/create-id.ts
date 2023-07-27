import { OrganizationModel } from "../../../models/medical/organization";
import { makeOrganizationOID } from "../../../shared/oid";

export async function createOrganizationId(): Promise<{ oid: string; organizationNumber: number }> {
  const maxOrgNumber = Number(await OrganizationModel.max("organizationNumber"));
  const organizationNumber = maxOrgNumber + 1;
  const oid = makeOrganizationOID(organizationNumber);
  return { oid, organizationNumber };
}
