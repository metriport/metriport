import { CWOrganization } from "./organization";
import cwCommands from "./";

export async function createOrUpdateCWOrganization(
  org: CWOrganization,
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
