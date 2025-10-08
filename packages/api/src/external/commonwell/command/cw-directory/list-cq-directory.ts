import { Organization } from "@metriport/commonwell-sdk";
import { out } from "@metriport/core/util/log";
import { makeCommonWellMemberAPI } from "../../../commonwell-v2/api";

const BATCH_SIZE = 1_000;

/**
 * Lists organizations from the CommonWell Directory.
 *
 * @param oid Optional, the OID of the organization to fetch.
 * @param limit Optional, the number of organizations to fetch.
 * @returns a list of CommonWell Organization resources.
 */
export async function listCwDirectory({
  oid,
  limit,
}: {
  oid?: string;
  limit?: number;
}): Promise<Organization[]> {
  const { log } = out(`listCQDirectory, oid ${oid}, limit ${limit}`);

  const cw = makeCommonWellMemberAPI();
  const orgs: Organization[] = [];

  const itemsToFetch = limit ?? BATCH_SIZE;
  let currentPosition = 0;
  let isDone = false;

  while (!isDone) {
    const batch = await cw.listOrganizations({
      offset: currentPosition,
      limit: itemsToFetch,
      orgId: oid,
      sort: "_id",
    });

    orgs.push(...batch.organizations);

    if (batch.organizations.length < itemsToFetch || (limit && orgs.length >= limit)) {
      isDone = true;
    } else {
      currentPosition += BATCH_SIZE;
    }
  }

  log(`Found ${orgs.length} organizations in the Carequality Directory`);

  return orgs;
}
