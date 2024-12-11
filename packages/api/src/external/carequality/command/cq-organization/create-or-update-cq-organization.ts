import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { makeCarequalityManagementAPIFhir } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQOrgDetails, CQOrgDetailsWithUrls, cqOrgUrlsSchema } from "../../shared";
import { getCqOrg } from "./get-cq-organization";
import { getOrganizationFhirTemplate } from "./organization-template";
import { parseCQOrganization } from "./parse-cq-organization";

export const metriportOid = Config.getSystemRootOID();
export const metriportIntermediaryOid = `${metriportOid}.666`;

export async function createOrUpdateCqOrganization(
  orgDetails: CQOrgDetails
): Promise<CQDirectoryEntryData> {
  const orgDetailsWithUrls = getOrgDetailsWithUrls(orgDetails);
  const org = await getCqOrg(orgDetailsWithUrls.oid);
  if (org) return await updateCQOrganization(orgDetailsWithUrls);
  return await createCQOrganization(orgDetailsWithUrls);
}

export async function updateCQOrganization(
  orgDetails: CQOrgDetailsWithUrls
): Promise<CQDirectoryEntryData> {
  const { log, debug } = out(`CQ updateCQOrganization - CQ Org OID ${orgDetails.oid}`);
  const carequalityOrg = getOrganizationFhirTemplate(orgDetails);
  const cq = makeCarequalityManagementAPIFhir();
  if (!cq) throw new Error("Carequality API not setup");

  try {
    const resp = await cq.updateOrganization({
      org: carequalityOrg,
      oid: orgDetails.oid,
    });
    debug(`resp updateOrganization: `, () => JSON.stringify(resp));
    return parseCQOrganization(resp);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const extra = {
      orgOid: orgDetails.oid,
      context: `cq.org.update`,
      carequalityOrg,
      error,
    };
    if (error.response?.status === 404) {
      capture.message("Got 404 while updating Org @ CQ, creating it", { extra });
      return await createCQOrganization(orgDetails);
    }
    const msg = `Failure while updating org @ CQ`;
    log(`${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, { extra });
    throw error;
  }
}

export async function createCQOrganization(
  orgDetails: CQOrgDetailsWithUrls
): Promise<CQDirectoryEntryData> {
  const { log, debug } = out(`CQ registerOrganization - CQ Org OID ${orgDetails.oid}`);
  const carequalityOrg = getOrganizationFhirTemplate(orgDetails);
  const cq = makeCarequalityManagementAPIFhir();
  if (!cq) throw new Error("Carequality API not setup");

  try {
    const resp = await cq.registerOrganization(carequalityOrg);
    debug(`resp registerOrganization: `, () => JSON.stringify(resp));
    return parseCQOrganization(resp);
  } catch (error) {
    const msg = `Failure while registering org @ CQ`;
    log(`${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: orgDetails.oid,
        context: `cq.org.create`,
        carequalityOrg,
        error,
      },
    });
    throw error;
  }
}

function getOrgDetailsWithUrls(orgDetails: CQOrgDetails): CQOrgDetailsWithUrls {
  const cqOrgUrlsString = Config.getCQOrgUrls();
  const urls = cqOrgUrlsString ? cqOrgUrlsSchema.parse(JSON.parse(cqOrgUrlsString)) : {};
  return {
    ...orgDetails,
    urlXCPD: urls.urlXCPD,
    urlDQ: urls.urlDQ,
    urlDR: urls.urlDR,
  };
}
