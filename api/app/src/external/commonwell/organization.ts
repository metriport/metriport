import { Organization as CWOrganization } from "@metriport/commonwell-sdk";

import { Organization } from "../../routes/medical/schemas/organization";
import { commonWellMember, CW_ID_PREFIX, queryMeta } from "../../shared/commonwell";
import { Config, getEnvVarOrFail } from "../../shared/config";
import { createOrgId } from "../../shared/oid";

const memberName = getEnvVarOrFail("CW_MEMBER_NAME");

const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

type CWOrganizationWithOrgId = Omit<CWOrganization, "organizationId"> &
  Required<Pick<CWOrganization, "organizationId">>;

export async function organizationToCommonwell(
  org: Organization
): Promise<CWOrganizationWithOrgId> {
  const orgId = org.id;
  const cwId = CW_ID_PREFIX.concat(orgId ? orgId : (await createOrgId()).orgId);
  return {
    name: org.name,
    type: org.type,
    locations: [
      {
        address1: org.location.addressLine1,
        address2: org.location.addressLine2,
        city: org.location.city,
        state: org.location.state,
        postalCode: org.location.postalCode,
        country: org.location.country,
      },
    ],
    // NOTE: IN STAGING IF THE ID ALREADY EXISTS IT WILL SAY INVALID ORG WHEN CREATING
    organizationId: cwId,
    homeCommunityId: cwId,
    patientIdAssignAuthority: cwId,
    displayName: org.name,
    memberName: memberName,
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

export const createOrUpdateCWOrg = async (localOrgPayload: Organization): Promise<void> => {
  const cwOrgPayload = await organizationToCommonwell(localOrgPayload);
  try {
    if (localOrgPayload.id) {
      await commonWellMember.updateOrg(queryMeta, cwOrgPayload, cwOrgPayload.organizationId);
    } else {
      await commonWellMember.createOrg(queryMeta, cwOrgPayload);
    }
  } catch (error) {
    throw new Error(`Failure creating or updating org with payload ${cwOrgPayload}`);
  }
};
