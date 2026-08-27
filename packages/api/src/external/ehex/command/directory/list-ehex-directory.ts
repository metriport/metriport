import { out } from "@metriport/core/util/log";
import { OrganizationWithId } from "@metriport/ehex-sdk/src/models/organization";
import { makeEhexManagementApiOrFail } from "../../api";

/**
 * Lists organizations from the Ehex Directory.
 *
 * @param oid Optional, the OID of the organization to fetch.
 * @param active Indicates whether to list active or inactive organizations.
 * @returns a list of FHIR R4 Organization resources with the `id` field populated.
 */
export async function listEhexDirectory({
  oid,
  active,
  limit,
}: {
  oid?: string;
  active: boolean;
  limit?: number;
}): Promise<OrganizationWithId[]> {
  const { log } = out(`listEhexDirectory, active: ${active}, oid: ${oid}, limit: ${limit}`);
  const ehex = await makeEhexManagementApiOrFail();

  const orgs: OrganizationWithId[] = [];
  let nextUrl: string | undefined;
  do {
    const response = await ehex.listOrganizations({
      active,
      count: limit,
      oid,
      url: nextUrl,
    });
    orgs.push(...response.organizations);
    nextUrl = response.link.next;
  } while (nextUrl);

  log(`Found ${orgs.length} organizations in the Ehex Directory`);
  return orgs;
}
