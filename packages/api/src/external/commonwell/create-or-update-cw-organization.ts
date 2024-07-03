import { CWOrganization } from "./organization";
import cwCommands from "./";

export async function createOrUpdateCWOrganization(
  cxId: string,
  org: CWOrganization,
  isObo = false
): Promise<void> {
  const orgExists = await doesOrganizationExistInCW(org.oid);
  if (orgExists) {
    return cwCommands.organization.update(cxId, org, isObo);
  }
  return cwCommands.organization.create(cxId, org, isObo);
}

async function doesOrganizationExistInCW(oid: string): Promise<boolean> {
  const org = await cwCommands.organization.get(oid);
  return !!org;
}
