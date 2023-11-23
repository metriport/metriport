import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { makeCarequalityAPI } from "./api";
import { buildOrganizationFromTemplate } from "./organization-template";
import BadRequestError from "@metriport/core/util/error/bad-request";

const cqOrgDetails = {
  orgName: getEnvVarOrFail("CQ_ORG_NAME"),
  orgOID: getEnvVarOrFail("CQ_ORG_OID"),
  addressLine1: getEnvVarOrFail("CQ_ADDRESS_LINE_1"),
  city: getEnvVarOrFail("CQ_CITY"),
  state: getEnvVarOrFail("CQ_STATE"),
  postalCode: getEnvVarOrFail("CQ_POSTAL_CODE"),
  latitude: getEnvVarOrFail("CQ_LATITUDE"),
  longitude: getEnvVarOrFail("CQ_LONGITUDE"),
  urlXCPD: getEnvVarOrFail("CQ_URL_XCPD"),
  urlDQ: getEnvVarOrFail("CQ_URL_DQ"),
  urlDR: getEnvVarOrFail("CQ_URL_DR"),
  contactName: getEnvVarOrFail("CQ_TECHNICAL_CONTACT_NAME"),
  phone: getEnvVarOrFail("CQ_TECHNICAL_CONTACT_PHONE"),
  email: getEnvVarOrFail("CQ_TECHNICAL_CONTACT_EMAIL"),
};

export async function registerCQOrganization(): Promise<void> {
  const cqOrg = buildOrganizationFromTemplate(cqOrgDetails);
  const cq = makeCarequalityAPI();
  try {
    await cq.registerOrganization(cqOrg);
  } catch (error) {
    const msg = `Failure registering org @ CQ Directory`;
    console.log(msg);
    throw new BadRequestError(msg, error);
  }
}
