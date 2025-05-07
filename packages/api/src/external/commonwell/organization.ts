import { Organization as CWSdkOrganization } from "@metriport/commonwell-sdk";
import { isEnhancedCoverageEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { Organization, OrgType } from "@metriport/core/domain/organization";
import { getOrgsByPrio } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, NotFoundError, USState } from "@metriport/shared";
import { Config, getEnvVarOrFail } from "../../shared/config";
import {
  getCertificate,
  makeCommonWellAPI,
  makeCommonWellManagementAPI,
  metriportQueryMeta,
} from "./api";

const MAX_HIGH_PRIO_ORGS = 50;

const technicalContact = {
  name: getEnvVarOrFail("CW_TECHNICAL_CONTACT_NAME"),
  title: getEnvVarOrFail("CW_TECHNICAL_CONTACT_TITLE"),
  email: getEnvVarOrFail("CW_TECHNICAL_CONTACT_EMAIL"),
  phone: getEnvVarOrFail("CW_TECHNICAL_CONTACT_PHONE"),
};

export type CWOrganization = Omit<
  Organization,
  | "id"
  | "cxId"
  | "type"
  | "organizationNumber"
  | "eTag"
  | "createdAt"
  | "updatedAt"
  | "cwActive"
  | "cqActive"
  | "cwApproved"
  | "cqApproved"
> & { active: boolean };

type CWSdkOrganizationWithOrgId = Omit<CWSdkOrganization, "organizationId"> &
  Required<Pick<CWSdkOrganization, "organizationId">>;
type CWSdkOrganizationLocation = Pick<CWSdkOrganization, "locations">["locations"][number];

export async function organizationToCommonwell(
  org: CWOrganization,
  isObo = false
): Promise<CWSdkOrganizationWithOrgId> {
  const cwId = OID_PREFIX.concat(org.oid);
  const cwOrg: CWSdkOrganizationWithOrgId = {
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
    memberName: Config.getCWMemberOrgName(),
    securityTokenKeyType: "BearerKey",
    isActive: org.active,
    technicalContacts: [technicalContact],
  };
  if (!isObo) {
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

export async function get(orgOid: string): Promise<CWSdkOrganization | undefined> {
  const { log, debug } = out(`CW get (Organization) - CW Org OID ${orgOid}`);
  const cwId = OID_PREFIX.concat(orgOid);

  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  try {
    const resp = await commonWell.getOneOrg(metriportQueryMeta, cwId);
    debug(`resp getOneOrg: `, JSON.stringify(resp));
    return resp;
  } catch (error) {
    const msg = `Failure while getting Org @ CW`;
    const cwRef = commonWell.lastReferenceHeader;
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

export async function create(cxId: string, org: CWOrganization, isObo = false): Promise<void> {
  const { log, debug } = out(`CW create (Organization) - CW Org OID ${org.oid}`);
  const commonwellOrg = await organizationToCommonwell(org, isObo);

  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  try {
    const respCreate = await commonWell.createOrg(metriportQueryMeta, commonwellOrg);
    debug(`resp createOrg: `, JSON.stringify(respCreate));
    const respAddCert = await commonWell.addCertificateToOrg(
      metriportQueryMeta,
      getCertificate(),
      org.oid
    );
    debug(`resp addCertificateToOrg: `, JSON.stringify(respAddCert));

    if (await isEnhancedCoverageEnabledForCx(cxId)) {
      // update the CQ bridge include list
      await initCQOrgIncludeList(org.oid);
    }
  } catch (error) {
    const msg = `Failure while creating org @ CW`;
    const cwRef = commonWell.lastReferenceHeader;
    log(`${msg}. Org OID: ${org.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        orgOid: org.oid,
        cwReference: cwRef,
        context: `cw.org.create`,
        commonwellOrg,
        error,
      },
    });
    throw error;
  }
}

export async function update(cxId: string, org: CWOrganization, isObo = false): Promise<void> {
  const { log, debug } = out(`CW update (Organization) - CW Org OID ${org.oid}`);
  const commonwellOrg = await organizationToCommonwell(org, isObo);

  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  try {
    const resp = await commonWell.updateOrg(
      metriportQueryMeta,
      commonwellOrg,
      commonwellOrg.organizationId
    );
    debug(`resp updateOrg: `, JSON.stringify(resp));
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const cwRef = commonWell.lastReferenceHeader;
    const extra = {
      orgOid: org.oid,
      cwReference: cwRef,
      context: `cw.org.update`,
      commonwellOrg,
      error,
    };
    if (error.response?.status === 404) {
      capture.message("Got 404 while updating Org @ CW, creating it", { extra });
      await create(cxId, org, isObo);
    }
    const msg = `Failure while updating org @ CW`;
    log(`${msg}. Org OID: ${org.oid}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, { extra });
    throw error;
  }
}

export async function initCQOrgIncludeList(orgOid: string): Promise<void> {
  const { log } = out(`CW initCQOrgIncludeList - CW Org OID ${orgOid}`);
  try {
    const managementApi = makeCommonWellManagementAPI();
    if (!managementApi) {
      log(`Not linking org ${orgOid} to CQ Bridge b/c no managementAPI is available`);
      return;
    }
    const highPrioOrgs = getOrgsByPrio().high;
    const cqOrgIds = highPrioOrgs.map(o => o.id);
    const cqOrgIdsLimited =
      cqOrgIds.length > MAX_HIGH_PRIO_ORGS ? cqOrgIds.slice(0, MAX_HIGH_PRIO_ORGS) : cqOrgIds;
    log(`Updating CQ include list for org ${orgOid} with ${cqOrgIdsLimited.length} high prio orgs`);
    await managementApi.updateIncludeList({ oid: orgOid, careQualityOrgIds: cqOrgIdsLimited });
  } catch (error) {
    const msg = `Error while updating CQ include list`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid,
        context: `cw.org.initCQOrgIncludeList`,
        error,
      },
    });
  }
}

export function parseCWEntry(org: CWSdkOrganization): CWOrganization {
  const location = org.locations[0] as CWSdkOrganizationLocation;
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
      type: org.type as OrgType,
    },
    oid: org.organizationId.replace(OID_PREFIX, ""),
    active: org.isActive,
  };
}

export async function getParsedOrgOrFail(oid: string): Promise<CWOrganization> {
  const resp = await get(oid);
  if (!resp) throw new NotFoundError("Organization not found");
  return parseCWEntry(resp);
}
