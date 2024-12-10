import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError } from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { makeCommonWellAPI, metriportQueryMeta } from "../../api";
import { CwOrgDetails } from "../../shared";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { parseCWOrganization } from "./parse-cw-organization";

export async function getCwOrg(orgOid: string): Promise<CwOrgDetails | undefined> {
  const { log, debug } = out(`CW getCwOrg - CW Org OID ${orgOid}`);
  const cwId = OID_PREFIX.concat(orgOid);
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());

  try {
    const org = await commonWell.getOneOrg(metriportQueryMeta, cwId);
    debug(`resp getOneOrg: `, JSON.stringify(org));
    return org ? parseCWOrganization(org) : undefined;
  } catch (error) {
    const msg = `Failure while getting Org @ CW`;
    const cwRef = commonWell.lastReferenceHeader;
    log(`${msg}. Org OID: ${orgOid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        orgOid,
        cwId,
        cwReference: cwRef,
        context: `cw.org.get`,
        error,
      },
    });
    throw error;
  }
}

export async function getOrgOrFail(oid: string): Promise<CwOrgDetails> {
  const org = await getCwOrg(oid);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}
