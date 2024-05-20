import { Organization } from "@metriport/core/domain/organization";
import cwCommands from "./";

export async function createOrUpdateCWOrganization(
  org: Omit<Organization, "type" | "eTag">,
  isObo = false
): Promise<void> {
  const orgExists = await doesOrganizationExistInCW(org.oid);
  if (orgExists) {
    return cwCommands.organization.update(org, isObo);
  }
  return cwCommands.organization.create(org, isObo);
}

async function doesOrganizationExistInCW(oid: string): Promise<boolean> {
  const org = await cwCommands.organization.get(oid);
  return !!org;
}
