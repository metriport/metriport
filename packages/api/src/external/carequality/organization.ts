import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeCarequalityAPI } from "./api";
import { buildOrganizationFromTemplate } from "./organization-template";

const cq = makeCarequalityAPI();

export type CQOrgDetails = {
  orgName: string;
  orgOID: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: string;
  lon: string;
  urlXCPD: string;
  urlDQ: string;
  urlDR: string;
  contactName: string;
  phone: string;
  email: string;
};

const cqOrgDetails: CQOrgDetails = JSON.parse(getEnvVarOrFail("CQ_ORG_DETAILS"));

export async function createOrUpdateCQOrganization(): Promise<void> {
  const cqOrg = buildOrganizationFromTemplate(cqOrgDetails);
  try {
    const org = await cq.listOrganizations({ count: 1, oid: cqOrgDetails.orgOID });
    if (org.length > 0) {
      await updateCQOrganization(cqOrg);
      return;
    }
  } catch (error) {
    console.log(`Failed to check if organization exists in the CQ Directory. Cause: ${error}`);
    throw error;
  }

  try {
    console.log(`Registering organization in the CQ Directory...`);
    await cq.registerOrganization(cqOrg);
  } catch (error) {
    console.log(`Failed to register organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}

async function updateCQOrganization(cqOrg: string): Promise<void> {
  console.log(`Updating org in the CQ Directory...`);
  try {
    await cq.updateOrganization(cqOrg, cqOrgDetails.orgOID);
  } catch (error) {
    console.log(`Failed to update organization in the CQ Directory. Cause: ${error}`);
    throw error;
  }
}
