import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Organization } from "../../models/medical/organization";
import { Config, getEnvVarOrFail } from "../../shared/config";
import { OID_PREFIX } from "../../shared/oid";
import { Util } from "../../shared/util";
import { certificate, makeCommonWellAPI, metriportQueryMeta } from "./api";

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
  const cwId = OID_PREFIX.concat(org.id);
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
    memberName: Config.getMetriportOrgName(),
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

export const create = async (org: Organization): Promise<void> => {
  const { log, debug } = Util.out(`CW create - M orgId ${org.id}`);
  const cwOrg = await organizationToCommonwell(org);
  try {
    const commonWell = makeCommonWellAPI(
      Config.getMetriportOrgName(),
      Config.getMemberManagementOID()
    );
    const respCreate = await commonWell.createOrg(metriportQueryMeta, cwOrg);
    debug(`resp respCreate: ${JSON.stringify(respCreate, null, 2)}`);
    const respAddCert = await commonWell.addCertificateToOrg(
      metriportQueryMeta,
      certificate,
      org.id
    );
    debug(`resp respAddCert: ${JSON.stringify(respAddCert, null, 2)}`);
  } catch (error) {
    const msg = `Failure creating Org`;
    log(`${msg} - payload: `, cwOrg);
    log(msg, error);
    throw new Error(msg);
  }
};

export const update = async (org: Organization): Promise<void> => {
  const { log, debug } = Util.out(`CW update - M orgId ${org.id}`);
  const cwOrg = await organizationToCommonwell(org);
  try {
    const commonWell = makeCommonWellAPI(
      Config.getMetriportOrgName(),
      Config.getMemberManagementOID()
    );
    const respUpdate = await commonWell.updateOrg(metriportQueryMeta, cwOrg, cwOrg.organizationId);
    debug(`resp respUpdate: ${JSON.stringify(respUpdate, null, 2)}`);
  } catch (error) {
    const msg = `Failure updating Org`;
    log(`${msg} - payload: `, cwOrg);
    log(msg, error);
    throw new Error(msg);
  }
};
