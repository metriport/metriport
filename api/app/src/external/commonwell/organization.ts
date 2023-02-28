import { Organization as CWOrganization } from "@metriport/commonwell-sdk";

import { Config } from "../../shared/config";
import { commonWellMember, queryMeta, CW_ID_PREFIX } from "../../shared/commonwell";
import BadRequestError from "../../errors/bad-request";
import { createOrgId } from "../../shared/oid";

const memberName = "Metriport";

const technicalContact = {
  name: "Metriport Team",
  title: "Engineering",
  email: "support@metriport.com",
  phone: "(415)-941-3282",
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
