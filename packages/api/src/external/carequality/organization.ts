import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeCarequalityAPI } from "./api";
import { buildOrganizationFromTemplate } from "./organization-template";

const cq = makeCarequalityAPI();

type CQOrgDetails = {
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

export async function registerCQOrganization(): Promise<void> {
  const cqOrg = buildOrganizationFromTemplate(cqOrgDetails);
  try {
    console.log(`Registering org in the CQ Directory...`);
    await cq.registerOrganization(cqOrg);
  } catch (error) {
    console.log(`Failure registering org @ CQ Directory. Cause: ${error}`);
    throw error;
  }
}

export async function updateCQOrganization(): Promise<void> {
  console.log(`Updating org in the CQ Directory...`);
  const cqOrg = buildOrganizationFromTemplate(cqOrgDetails);
  try {
    await cq.updateOrganization(cqOrg, cqOrgDetails.orgOID);
  } catch (error) {
    console.log(`Failure updating org @ CQ Directory. Cause: ${error}`);
    throw error;
  }
}
