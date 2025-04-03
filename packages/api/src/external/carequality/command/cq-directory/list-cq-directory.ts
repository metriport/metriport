import { OrganizationWithId } from "@metriport/carequality-sdk/client/carequality";
import { out } from "@metriport/core/util/log";
import { makeCarequalityManagementApiOrFail } from "../../api";

const BATCH_SIZE = 1_000;

/**
 * Lists organizations from the Carequality Directory.
 *
 * @param oid Optional, the OID of the organization to fetch.
 * @param active Indicates whether to list active or inactive organizations.
 * @returns a list of FHIR R4 Organization resources with the `id` field populated.
 */
export async function listCQDirectory({
  oid,
  active,
  limit,
}: {
  oid?: string;
  active: boolean;
  limit?: number;
}): Promise<OrganizationWithId[]> {
  const { log } = out(`listCQDirectory, active ${active}, oid ${oid}`);

  const cq = makeCarequalityManagementApiOrFail();
  const orgs: OrganizationWithId[] = [];

  const itemsToFetch = limit ?? BATCH_SIZE;
  let currentPosition = 0;
  let isDone = false;

  while (!isDone) {
    const batch = await cq.listOrganizations({
      start: currentPosition,
      count: itemsToFetch,
      oid,
      active,
      sortKey: "_id",
    });

    orgs.push(...batch);

    if (batch.length < itemsToFetch || (limit && orgs.length >= limit)) {
      isDone = true;
    } else {
      currentPosition += BATCH_SIZE;
    }
  }

  log(`Found ${orgs.length} organizations in the Carequality Directory`);

  return orgs;
}
