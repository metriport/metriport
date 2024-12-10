import { getOrgsByPrio } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { makeCommonWellManagementAPI } from "../../api";

const MAX_HIGH_PRIO_ORGS = 50;

export async function initCQOrgIncludeList(orgOid: string): Promise<void> {
  const { log } = out(`CW initCQOrgIncludeList - CW Org OID ${orgOid}`);
  try {
    const managementApi = makeCommonWellManagementAPI();
    if (!managementApi) {
      log(`Not linking org ${orgOid} to CQ Bridge b/c no managementAPI is available`);
      return;
    }
    const highPrioOrgs = getOrgsByPrio().high;
    const cqOrgIds = highPrioOrgs.map(o => o.id);
    const cqOrgIdsLimited =
      cqOrgIds.length > MAX_HIGH_PRIO_ORGS ? cqOrgIds.slice(0, MAX_HIGH_PRIO_ORGS) : cqOrgIds;
    log(`Updating CQ include list for org ${orgOid} with ${cqOrgIdsLimited.length} high prio orgs`);
    await managementApi.updateIncludeList({ oid: orgOid, careQualityOrgIds: cqOrgIdsLimited });
  } catch (error) {
    const msg = `Error while updating CQ include list`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid,
        context: `cw.org.initCQOrgIncludeList`,
        error,
      },
    });
  }
}
