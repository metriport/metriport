import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { makeCarequalityManagementAPI } from "../../api";
import { CQOrganization } from "../../organization";
import { CQOrgDetails } from "../../shared";

const cq = makeCarequalityManagementAPI();

export async function createOrUpdateCQOrganization(orgDetails: CQOrgDetails): Promise<void> {
  if (!cq) throw new Error("Carequality API not initialized");
  const org = CQOrganization.fromDetails(orgDetails);
  console.log("ORG IS", org.getXmlString());
  // const orgExists = await doesOrganizationExistInCQ(cq, org.oid);
  // if (orgExists) {
  //   await updateCQOrganization(cq, org);
  // } else {
  //   await registerOrganization(cq, org);
  // }
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

async function updateCQOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<void> {
  console.log(`Updating organization in the CQ Directory with OID: ${cqOrg.oid}...`);
  try {
    await cq.updateOrganization(cqOrg.getXmlString(), cqOrg.oid);
  } catch (error) {
    console.log(`Failed to update organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}

async function registerOrganization(
  cq: CarequalityManagementAPI,
  cqOrg: CQOrganization
): Promise<void> {
  try {
    console.log(`Registering organization in the CQ Directory with OID: ${cqOrg.oid}...`);
    await cq.registerOrganization(cqOrg.getXmlString());
  } catch (error) {
    console.log(`Failed to register organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}
