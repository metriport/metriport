import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { isEnhancedCoverageEnabledForCx } from "../../../aws/app-config";
import { getCertificate, makeCommonWellAPI, metriportQueryMeta } from "../../api";
import { CwOrgDetails } from "../../shared";
import { getCwOrg } from "./get-cw-organization";
import { initCQOrgIncludeList } from "./init-cq-include-list";
import { getOrganzationCwTemplate } from "./organization-template";
import { parseCWOrganization } from "./parse-cw-organization";

export async function createOrUpdateCwOrganization({
  cxId,
  orgDetails,
}: {
  cxId: string;
  orgDetails: CwOrgDetails;
}): Promise<CwOrgDetails> {
  const orgExists = await getCwOrg(orgDetails.oid);
  if (orgExists) return await updateCWOrganization(cxId, orgDetails);
  return await createCWOrganization(cxId, orgDetails);
}

export async function updateCWOrganization(
  cxId: string,
  orgDetails: CwOrgDetails
): Promise<CwOrgDetails> {
  const { log, debug } = out(`CW updateCWOrganization) - CW Org OID ${orgDetails.oid}`);
  const commonwellOrg = await getOrganzationCwTemplate(orgDetails);
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());

  try {
    const resp = await commonWell.updateOrg(
      metriportQueryMeta,
      commonwellOrg,
      commonwellOrg.organizationId
    );
    log(`Update @ CW done`);
    debug(`resp updateOrg: `, () => JSON.stringify(resp));
    return parseCWOrganization(resp);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const cwRef = commonWell.lastReferenceHeader;
    const extra = {
      orgOid: orgDetails.oid,
      cwReference: cwRef,
      context: `cw.org.update`,
      commonwellOrg,
      error,
    };
    if (error.response?.status === 404) {
      capture.message("Got 404 while updating Org @ CW, creating it", { extra });
      return await createCWOrganization(cxId, orgDetails);
    }
    const msg = `Failure while updating org @ CW`;
    log(
      `${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, { extra });
    throw error;
  }
}

export async function createCWOrganization(
  cxId: string,
  orgDetails: CwOrgDetails
): Promise<CwOrgDetails> {
  const { log, debug } = out(`CW createCWOrganization - CW Org OID ${orgDetails.oid}`);
  const commonwellOrg = await getOrganzationCwTemplate(orgDetails);
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());

  try {
    const respCreate = await commonWell.createOrg(metriportQueryMeta, commonwellOrg);
    log(`Create @ CW done`);
    debug(`resp createOrg: `, () => JSON.stringify(respCreate));
    const respAddCert = await commonWell.addCertificateToOrg(
      metriportQueryMeta,
      getCertificate(),
      orgDetails.oid
    );
    log(`Cert added to CW`);
    debug(`resp addCertificateToOrg: `, () => JSON.stringify(respAddCert));
    if (await isEnhancedCoverageEnabledForCx(cxId)) {
      // update the CQ bridge include list
      await initCQOrgIncludeList(orgDetails.oid);
    }
    return parseCWOrganization(respCreate);
  } catch (error) {
    const msg = `Failure while creating org @ CW`;
    const cwRef = commonWell.lastReferenceHeader;
    log(
      `${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        orgOid: orgDetails.oid,
        cwReference: cwRef,
        context: `cw.org.create`,
        commonwellOrg,
        error,
      },
    });
    throw error;
  }
}
