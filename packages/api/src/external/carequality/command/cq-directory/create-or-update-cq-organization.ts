import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails } from "../../shared";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(orgDetails: CQOrgDetails): Promise<void> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  const cqOrgString = org.toXmlString();
  const orgExists = await doesCQOrganizationExist(org.oid);
  if (orgExists) {
    await updateCQOrganization(cq, cqOrgString, org.oid);
  } else {
    await registerOrganization(cq, cqOrgString);
  }
}

async function doesCQOrganizationExist(oid: string): Promise<boolean> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = await cq.listOrganizations({ count: 1, oid });
  if (org.length > 0) {
    return true;
  }
  return false;
}

async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: string,
  oid: string
): Promise<void> {
  console.log(`Updating organization in the CQ Directory with OID: ${oid}...`);
  try {
    await cq.updateOrganization(cqOrg, oid);
  } catch (error) {
    console.log(`Failed to update organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}

async function registerOrganization(cq: CarequalityManagementAPI, cqOrg: string): Promise<void> {
  try {
    console.log(`Registering organization in the CQ Directory...`);
    await cq.registerOrganization(cqOrg);
  } catch (error) {
    console.log(`Failed to register organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}
