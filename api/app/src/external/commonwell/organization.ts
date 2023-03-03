import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Organization, OrganizationCreate } from "../../models/medical/organization";
import { Config, getEnvVarOrFail } from "../../shared/config";
import { createOrgId } from "../../shared/oid";
import { commonWellMember, CW_ID_PREFIX, metriportQueryMeta } from "./api";

// TODO move these "getEnvVarOrFail" to Config
const metriportOrgName = getEnvVarOrFail("CW_MEMBER_NAME");
const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

type CWOrganizationWithOrgId = Omit<CWOrganization, "organizationId"> &
  Required<Pick<CWOrganization, "organizationId">>;

export async function organizationToCommonwell(
  org: Organization | OrganizationCreate
): Promise<CWOrganizationWithOrgId> {
  const orgId = org instanceof Organization ? org.id : undefined;
  const cwId = CW_ID_PREFIX.concat(orgId ? orgId : (await createOrgId()).orgId);
  return {
    name: org.data.name,
    type: org.data.type,
    locations: [
      {
        address1: org.data.location.addressLine1,
        ...(org.data.location.addressLine2
          ? { address2: org.data.location.addressLine2 }
          : undefined),
        city: org.data.location.city,
        state: org.data.location.state,
        postalCode: org.data.location.zip,
        country: org.data.location.country,
      },
    ],
    // NOTE: IN STAGING IF THE ID ALREADY EXISTS IT WILL SAY INVALID ORG WHEN CREATING
    organizationId: cwId,
    homeCommunityId: cwId,
    patientIdAssignAuthority: cwId,
    displayName: org.data.name,
    memberName: metriportOrgName,
    securityTokenKeyType: "BearerKey",
    isActive: true,
    gateways: [
      {
        serviceType: "XCA_Query",
        gatewayType: "R4",
        endpointLocation: Config.getGatewayEndpoint(),
      },
    ],
    authorizationInformation: {
      authorizationServerEndpoint: Config.getGatewayAuthorizationServerEndpoint(),
      clientId: Config.getGatewayAuthorizationClientId(),
      clientSecret: Config.getGatewayAuthorizationClientSecret(),
      documentReferenceScope: "fhir/document",
      binaryScope: "fhir/document",
    },
    technicalContacts: [technicalContact],
  };
}

export const createOrgAtCommonwell = async (org: OrganizationCreate): Promise<void> => {
  const cwOrg = await organizationToCommonwell(org);
  try {
    await commonWellMember.createOrg(metriportQueryMeta, cwOrg);
  } catch (error) {
    const msg = `Failure creating Org`;
    console.log(`${msg} - payload: `, cwOrg);
    console.log(msg, error);
    throw new Error(msg);
  }
};

export const updateOrgAtCommonwell = async (org: Organization): Promise<void> => {
  const cwOrg = await organizationToCommonwell(org);
  try {
    await commonWellMember.updateOrg(metriportQueryMeta, cwOrg, cwOrg.organizationId);
  } catch (error) {
    const msg = `Failure updating Org`;
    console.log(`${msg} - payload: `, cwOrg);
    console.log(msg, error);
    throw new Error(msg);
  }
};
