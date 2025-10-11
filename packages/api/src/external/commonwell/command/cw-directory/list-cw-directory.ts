import { Organization } from "@metriport/commonwell-sdk";
import { out } from "@metriport/core/util/log";
import { makeCommonWellMemberAPI } from "../../../commonwell-v2/api";

const BATCH_SIZE = 100;

/**
 * Returns organizations from the CommonWell Directory.
 *
 * @param oid Optional, the OID of the organization to fetch.
 * @returns a list of CommonWell Organization resources.
 */
export async function getCwDirectoryEntry(oid?: string): Promise<Organization[]> {
  const { log } = out(`getCwDirectoryEntry, oid ${oid}`);

  const cw = makeCommonWellMemberAPI();

  const batch = await cw.listOrganizations({
    offset: 0,
    limit: oid ? undefined : BATCH_SIZE,
    orgId: oid,
    sort: "_id",
  });

  log(`Found ${batch.organizations.length} organizations in the CommonWell Directory`);
  return batch.organizations;
}
