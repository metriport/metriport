import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPI } from "../../api";
import { CQDirectoryEntryData2 } from "../../cq-directory";
import { parseCQOrganization } from "./parse-cq-organization";

export async function getCqOrg(oid: string): Promise<CQDirectoryEntryData2 | undefined> {
  const { log, debug } = out(`CQ getCqOrg - OID ${oid}`);
  const cq = makeCarequalityManagementAPI();
  if (!cq) return undefined;

  try {
    const org = await cq.getOrganization(oid);
    debug(`resp getOrganization: `, () => JSON.stringify(org));
    if (!org) return undefined;
    return parseCQOrganization(org);
  } catch (error) {
    const msg = `Failure while getting Org @ CQ`;
    log(`${msg}. Org OID: ${oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: oid,
        context: `cq.org.get`,
        error,
      },
    });
    throw error;
  }
}

export async function getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData2> {
  const org = await getCqOrg(oid);
  if (!org) throw new NotFoundError("CQ Organization not found");
  return org;
}
