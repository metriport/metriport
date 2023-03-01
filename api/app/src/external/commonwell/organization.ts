import { Organization as CWOrganization } from "@metriport/commonwell-sdk";

import { Config, getEnvVarOrFail } from "../../shared/config";
import { commonWellMember, queryMeta, CW_ID_PREFIX } from "../../shared/commonwell";
import BadRequestError from "../../errors/bad-request";
import { createOrgId } from "../../shared/oid";

const memberName = getEnvVarOrFail("CW_MEMBER_NAME");

const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

export const createOrUpdateCWOrg = async ({
  orgId,
  name,
  localOrgPayload,
}: {
  orgId?: string | null;
  name: string;
  localOrgPayload: object;
}): Promise<void> => {
  let cwId = `${CW_ID_PREFIX}`;

  if (orgId) {
    cwId = cwId.concat(orgId);
  } else {
    const { orgId: localOrgId } = await createOrgId();
    cwId = cwId.concat(localOrgId);
  }

  const cwOrgPayload: CWOrganization = {
    ...localOrgPayload,
    // NOTE: IN STAGING IF THE ID ALREADY EXISTS IT WILL SAY INVALID ORG WHEN CREATING
    organizationId: cwId,
    homeCommunityId: cwId,
    patientIdAssignAuthority: cwId,
    displayName: name,
    memberName: memberName,
    securityTokenKeyType: "BearerKey",
    isActive: true,
    gateways: [
      {
        serviceType: "XCA_Query",
        gatewayType: "R4",
        endpointLocation: Config.getFHIRServerUrl(),
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

  try {
    if (orgId) {
      await commonWellMember.updateOrg(queryMeta, cwOrgPayload, cwId);
    } else {
      await commonWellMember.createOrg(queryMeta, cwOrgPayload);
    }
  } catch (error) {
    throw new BadRequestError(`Failure creating or updating org with payload ${cwOrgPayload}`);
  }
};
