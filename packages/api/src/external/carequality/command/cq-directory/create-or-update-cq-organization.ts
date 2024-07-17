import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails } from "../../shared";
import { isCQDirectEnabledForCx } from "../../../aws/app-config";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(
  cxId: string,
  orgDetails: CQOrgDetails
): Promise<string | undefined> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const orgExists = await doesOrganizationExistInCQ(cq, cxId, org.oid);
  if (orgExists) {
    return updateCQOrganization(cq, cxId, org);
  }
  return registerOrganization(cq, cxId, org);
}

async function doesOrganizationExistInCQ(
  cq: CarequalityManagementAPI,
  cxId: string,
  oid: string
): Promise<boolean | undefined> {
  const { log } = out(`CQ get (Organization) - CQ Org OID ${oid}`);
  if (!(await isCQDirectEnabledForCx(cxId))) {
    log(`CQ disabled for cx ${cxId}, skipping...`);
    return undefined;
  }
  try {
    const resp = await cq.listOrganizations({ count: 1, oid });
    return resp.length > 0;
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

async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cxId: string,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ update (Organization) - CQ Org OID ${cqOrg.oid}`);
  if (!(await isCQDirectEnabledForCx(cxId))) {
    log(`CQ disabled for cx ${cxId}, skipping...`);
    return undefined;
  }

  try {
    return await cq.updateOrganization(cqOrg.getXmlString(), cqOrg.oid);
  } catch (error) {
    const msg = `Failure while updating org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.update`,
        error,
      },
    });
    throw error;
  }
}

async function registerOrganization(
  cq: CarequalityManagementAPI,
  cxId: string,
  cqOrg: CQOrganization
): Promise<string | undefined> {
  const { log } = out(`CQ register (Organization) - CQ Org OID ${cqOrg.oid}`);
  if (!(await isCQDirectEnabledForCx(cxId))) {
    log(`CQ disabled for cx ${cxId}, skipping...`);
    return undefined;
  }
  console.log(`Registering organization in the CQ Directory with OID: ${cqOrg.oid}...`);
  try {
    return await cq.registerOrganization(cqOrg.getXmlString());
  } catch (error) {
    const msg = `Failure while registering org @ CQ`;
    log(`${msg}. Org OID: ${cqOrg.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: cqOrg.oid,
        context: `cq.org.create`,
        error,
      },
    });
    throw error;
  }
}
