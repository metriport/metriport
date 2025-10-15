import { Organization } from "@metriport/commonwell-sdk";
import { capture } from "@metriport/core/util";
import { BadRequestError, NotFoundError } from "@metriport/shared";
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
  if (batch.organizations.length > 1) {
    const msg = "Multiple organizations found in the CommonWell Directory";
    capture.error(msg, {
      extra: {
        oid,
      },
    });
    throw new BadRequestError(msg, undefined, {
      oid,
    });
  }

  const org = batch.organizations[0];
  if (!org) {
    throw new NotFoundError("No organization found in the CommonWell Directory", undefined, {
      oid,
    });
  }
  return org;
}
