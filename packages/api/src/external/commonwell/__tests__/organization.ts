import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Config } from "../../../shared/config";
import { capture } from "@metriport/core/util/notifications";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { Util } from "../../../shared/util";
import { makeCommonWellAPI, metriportQueryMeta } from "../api";

/**
 * For E2E testing locally and staging.
 */
export const getOne = async (orgOid: string): Promise<CWOrganization | undefined> => {
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  const { log, debug } = Util.out(`CW get - id ${orgOid}`);
  const cwId = OID_PREFIX.concat(orgOid);
  try {
    const resp = await commonWell.getOneOrg(metriportQueryMeta, cwId);
    debug(`resp: `, JSON.stringify(resp));
    return resp;
  } catch (error) {
    const msg = `[E2E]: Failure getting Org @ CW`;
    log(msg, error);
    capture.message(msg, {
      extra: {
        orgOid,
        cwId,
        cwReference: commonWell.lastReferenceHeader,
        context: `cw.org.get`,
        error,
      },
    });
    throw error;
  }
};
