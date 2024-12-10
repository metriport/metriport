import { getEnvVarOrFail } from "@metriport/shared";
import { CwOrgDetails } from "../../shared";
import { Organization } from "@metriport/commonwell-sdk";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { Config } from "../../../../shared/config";

const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

type OrganizationWithOrgId = Organization & {
  organizationId: string;
};

export async function getOrganzationCwTemplate(orgDetails: CwOrgDetails): Promise<Organization> {
  const cwId = OID_PREFIX.concat(orgDetails.oid);
  const cwOrg: OrganizationWithOrgId = {
    name: orgDetails.data.name,
    type: orgDetails.data.type,
    locations: [
      {
        address1: orgDetails.data.location.addressLine1,
        ...(orgDetails.data.location.addressLine2
          ? { address2: orgDetails.data.location.addressLine2 }
          : undefined),
        city: orgDetails.data.location.city,
        state: orgDetails.data.location.state,
        postalCode: orgDetails.data.location.zip,
        country: orgDetails.data.location.country,
      },
    ],
    // NOTE: IN STAGING IF THE ID ALREADY EXISTS IT WILL SAY INVALID ORG WHEN CREATING
    organizationId: cwId,
    homeCommunityId: cwId,
    patientIdAssignAuthority: cwId,
    displayName: orgDetails.data.name,
    memberName: Config.getCWMemberOrgName(),
    securityTokenKeyType: "BearerKey",
    isActive: orgDetails.active,
    technicalContacts: [technicalContact],
  };
  if (!orgDetails.isObo) {
    cwOrg.authorizationInformation = {
      authorizationServerEndpoint: Config.getGatewayAuthorizationServerEndpoint(),
      clientId: Config.getGatewayAuthorizationClientId(),
      clientSecret: Config.getGatewayAuthorizationClientSecret(),
      documentReferenceScope: "fhir/document",
      binaryScope: "fhir/document",
    };
    cwOrg.gateways = [
      {
        serviceType: "XCA_Query",
        gatewayType: "R4",
        endpointLocation: Config.getGatewayEndpoint(),
      },
    ];
  }
  return cwOrg;
}
