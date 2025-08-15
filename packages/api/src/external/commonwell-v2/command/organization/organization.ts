import {
  isOrgInitiatorAndResponder,
  Organization as CwSdkOrganization,
} from "@metriport/commonwell-sdk";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { OrganizationData } from "@metriport/core/domain/organization";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  errorToString,
  getEnvVarOrFail,
  MetriportError,
  NotFoundError,
  TreatmentType,
  USState,
} from "@metriport/shared";
import { Config } from "../../../../shared/config";
import { getCertificate, makeCommonWellMemberAPI } from "../../api";

const defaultSearchRadius = 150;

const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

export type CwOrgOrFacility = {
  oid: string;
  data: OrganizationData;
  active: boolean;
  isInitiatorAndResponder: boolean;
};

type CwSdkOrganizationWithOrgId = Omit<CwSdkOrganization, "organizationId"> &
  Required<Pick<CwSdkOrganization, "organizationId">>;

function cwOrgOrFacilityToSdk(org: CwOrgOrFacility): CwSdkOrganizationWithOrgId {
  const cwId = org.oid;
  const cwOrg: CwSdkOrganizationWithOrgId = {
    name: org.data.name,
    type: org.data.type,
    searchRadius: defaultSearchRadius,
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
    memberName: Config.getCWMemberOrgName(),
    securityTokenKeyType: "JWT",
    isActive: org.active,
    technicalContacts: [technicalContact],
    networks: [
      {
        type: "CommonWell",
        purposeOfUse: [
          {
            id: "TREATMENT",
            queryInitiatorOnly: !org.isInitiatorAndResponder,
            queryInitiator: org.isInitiatorAndResponder,
            queryResponder: org.isInitiatorAndResponder,
          },
        ],
      },
    ],
  };
  if (org.isInitiatorAndResponder) {
    cwOrg.authorizationInformation = {
      authorizationServerEndpoint: Config.getGatewayAuthorizationServerEndpoint(),
      clientId: Config.getGatewayAuthorizationClientId(),
      clientSecret: Config.getGatewayAuthorizationClientSecret(),
      documentReferenceScope: "fhir/document",
      binaryScope: "fhir/document",
    };
    cwOrg.gateways = [
      {
        serviceType: "R4_Base",
        gatewayType: "FHIR",
        endpointLocation: Config.getGatewayEndpoint(),
      },
    ];
  }
  return cwOrg;
}

export async function get(orgOid: string): Promise<CwSdkOrganization | undefined> {
  const { log, debug } = out(`CW.v2 get Org - CW Org OID ${orgOid}`);
  const cwId = orgOid;

  const commonWell = makeCommonWellMemberAPI();
  try {
    const resp = await commonWell.getOneOrg(cwId);
    debug(`resp getOneOrg: `, JSON.stringify(resp));
    return resp;
  } catch (error) {
    const msg = `Failure while getting Org @ CW`;
    const cwRef = commonWell.lastTransactionId;
    log(`${msg}. Org OID: ${orgOid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        orgOid,
        cwId,
        cwReference: cwRef,
        context: `cw.org.get`,
        error,
      },
    });
    throw error;
  }
}

export async function create(cxId: string, org: CwOrgOrFacility): Promise<void> {
  const { log, debug } = out(`CW.v2 create Org - cx ${cxId}, CW Org OID ${org.oid}`);

  const sdkOrg = cwOrgOrFacilityToSdk(org);
  const commonWell = makeCommonWellMemberAPI();
  try {
    const respCreate = await commonWell.createOrg(sdkOrg);
    debug(`resp createOrg: `, JSON.stringify(respCreate));
    const respAddCert = await commonWell.addCertificateToOrg(getCertificate(), org.oid);
    debug(`resp addCertificateToOrg: `, JSON.stringify(respAddCert));
  } catch (error) {
    const msg = `Failure while creating org @ CW`;
    const cwRef = commonWell.lastTransactionId;
    log(`${msg}. Org OID: ${org.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        orgOid: org.oid,
        cwReference: cwRef,
        context: `cw.org.create`,
        commonwellOrg: sdkOrg,
        error,
      },
    });
    throw error;
  }
}

export async function update(cxId: string, org: CwOrgOrFacility): Promise<void> {
  const { log, debug } = out(`CW.v2 update Org - cx ${cxId}, CW Org OID ${org.oid}`);

  const sdkOrg = cwOrgOrFacilityToSdk(org);
  const commonWell = makeCommonWellMemberAPI();
  try {
    const resp = await commonWell.updateOrg(sdkOrg);
    debug(`resp updateOrg: `, JSON.stringify(resp));
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const cwRef = commonWell.lastTransactionId;
    const extra = {
      orgOid: org.oid,
      cwReference: cwRef,
      context: `cw.org.update`,
      commonwellOrg: sdkOrg,
      error,
    };
    if (error.response?.status === 404) {
      capture.message("Got 404 while updating Org @ CW, creating it", { extra });
      await create(cxId, org);
    }
    const msg = `Failure while updating org @ CW`;
    log(`${msg}. Org OID: ${org.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, { extra });
    throw error;
  }
}

export function parseCWEntry(org: CwSdkOrganization): CwOrgOrFacility {
  const location = org.locations[0];
  if (!location)
    throw new MetriportError("Missing location on CW Organization", undefined, {
      orgOid: org.organizationId,
      orgName: org.name,
    });
  return {
    data: {
      name: org.name,
      location: {
        addressLine1: location.address1,
        addressLine2: location.address2 ? location.address2 : undefined,
        city: location.city,
        state: location.state as USState,
        zip: location.postalCode,
        country: location.country,
      },
      type: org.type as TreatmentType,
    },
    oid: org.organizationId.replace(OID_PREFIX, ""),
    active: org.isActive,
    isInitiatorAndResponder: isOrgInitiatorAndResponder(org),
  };
}

export async function getParsedOrgOrFailV2(oid: string): Promise<CwOrgOrFacility> {
  const resp = await get(oid);
  if (!resp) throw new NotFoundError("Organization not found", undefined, { orgOid: oid });
  return parseCWEntry(resp);
}
