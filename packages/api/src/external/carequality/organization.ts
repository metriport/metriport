import { Config } from "../../shared/config";
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

const cqOrgDetailsString = Config.getCQOrgDetails();
const cqOrgDetails = cqOrgDetailsString ? JSON.parse(cqOrgDetailsString) : undefined;

export async function createOrUpdateCQOrganization(): Promise<void> {
  if (!cqOrgDetails) {
    const msg = "No CQ Organization details found. Skipping...";
    console.log(msg);
    throw new Error(msg);
  }
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
