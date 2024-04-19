import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { Organization } from "@metriport/carequality-sdk/models/organization";
import { errorToString } from "@metriport/shared/common/error";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails } from "../../shared";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(orgDetails: CQOrgDetails): Promise<string> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const orgExists = await doesOrganizationExistInCQ(cq, org.oid);
  if (orgExists) {
    return updateCQOrganization(cq, org);
  }
  return registerOrganization(cq, org);
}

async function doesOrganizationExistInCQ(
  cq: CarequalityManagementAPI,
  oid: string
): Promise<boolean> {
  const org = await cq.listOrganizations({ count: 1, oid });
  if (org.length > 0) {
    return true;
  }
  return false;
}

export async function getCqOrganization(oid: string): Promise<Organization | undefined> {
  if (!cq) throw new Error("Carequality API not initialized");
  const organizations = await cq.listOrganizations({ count: 1, oid });
  return organizations[0];
}

async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string> {
  console.log(`Updating organization in the CQ Directory with OID: ${cqOrg.oid}...`);
  try {
    return await cq.updateOrganization(cqOrg.getXmlString(), cqOrg.oid);
  } catch (error) {
    console.log(
      `Failed to update organization in the CQ Directory. Cause: ${errorToString(error)}`
    );
    throw error;
  }
}

async function registerOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<string> {
  try {
    console.log(`Registering organization in the CQ Directory with OID: ${cqOrg.oid}...`);
    return await cq.registerOrganization(cqOrg.getXmlString());
  } catch (error) {
    console.log(
      `Failed to register organization in the CQ Directory. Cause: ${errorToString(error)}`
    );
    throw error;
  }
}
