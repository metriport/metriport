import { Organization } from "@metriport/commonwell-sdk";
import { MetriportError } from "@metriport/shared";
import { makeCommonWellMemberAPI } from "../../../commonwell-v2/api";

/**
 * Returns the organization with the given OID from the CommonWell Directory.
 *
 * @param oid The OID of the organization to fetch.
 * @returns a CommonWell Organization resource.
 */
export async function getCwDirectoryEntry(oid: string): Promise<Organization> {
  const cw = makeCommonWellMemberAPI();

  const batch = await cw.listOrganizations({ limit: 1, orgId: oid });
  const org = batch.organizations[0];

  if (!org) {
    throw new MetriportError("No organization found in the CommonWell Directory", undefined, {
      oid,
    });
  }
  return org;
}
