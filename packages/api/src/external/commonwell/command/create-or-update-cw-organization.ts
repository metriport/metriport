import { CWOrganization, get, update, create } from "../organization";

export async function createOrUpdateCWOrganization(
  cxId: string,
  org: CWOrganization,
  isObo = false
): Promise<void> {
  const orgExists = await doesOrganizationExistInCW(cxId, org.oid);
  if (orgExists) {
    return update(cxId, org, isObo);
  }
  return create(cxId, org, isObo);
}

async function doesOrganizationExistInCW(cxId: string, oid: string): Promise<boolean> {
  const org = await get(cxId, oid);
  return !!org;
}
