import { getEnvVar } from "@metriport/shared";
import { OrganizationModel } from "../../../models/medical/organization";
import { makeOrganizationOID } from "../../../shared/oid";

export async function createOrganizationId(): Promise<{ oid: string; organizationNumber: number }> {
  let maxOrgNumber = Number(await OrganizationModel.max("organizationNumber"));

  // If the environment variable is set, add it to the max org number
  const organizationNumberOffset = parseInt(getEnvVar("ORGANIZATION_NUMBER_OFFSET") ?? "0");
  if (isFinite(organizationNumberOffset)) {
    maxOrgNumber += organizationNumberOffset;
  }

  const organizationNumber = maxOrgNumber + 1;
  const oid = makeOrganizationOID(organizationNumber);
  return { oid, organizationNumber };
}
