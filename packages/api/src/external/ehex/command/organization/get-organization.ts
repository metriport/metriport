import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { OrganizationWithId } from "@metriport/ehex-sdk/src/models/organization";
import { errorToString, NotFoundError } from "@metriport/shared";
import { makeEhexManagementApiOrFail } from "../../api";

export async function getEhexOrg(oid: string): Promise<OrganizationWithId | undefined> {
  const { log, debug } = out(`Ehex getEhexOrg - OID ${oid}`);
  const ehex = await makeEhexManagementApiOrFail();

  try {
    const org = await ehex.getOrganization(oid);
    debug(`resp getOrganization: `, () => JSON.stringify(org));
    if (!org) return undefined;
    return org;
  } catch (error) {
    const msg = `Failure while getting Org @ Ehex`;
    log(`${msg}. Org OID: ${oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: oid,
        context: `ehex.org.get`,
        error,
      },
    });
    throw error;
  }
}

export async function getEhexOrgOrFail(oid: string): Promise<OrganizationWithId> {
  const org = await getEhexOrg(oid);
  if (!org) throw new NotFoundError("Ehex Organization not found");
  return org;
}
