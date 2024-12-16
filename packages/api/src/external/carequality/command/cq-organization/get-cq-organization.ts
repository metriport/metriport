import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError } from "@metriport/shared";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { parseCQOrganization } from "./parse-cq-organization";

export async function getCqOrg(oid: string): Promise<CQDirectoryEntryData | undefined> {
  const { log, debug } = out(`CQ getCqOrg - OID ${oid}`);
  const cq = makeCarequalityManagementAPIFhir();

  try {
    const org = await cq.getOrganization(oid);
    debug(`resp getOrganization: `, () => JSON.stringify(org));
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

export async function getCqOrgOrFail(oid: string): Promise<CQDirectoryEntryData> {
  const org = await getCqOrg(oid);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}
