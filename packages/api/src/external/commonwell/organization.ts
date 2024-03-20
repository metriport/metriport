import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { getOrgsByPrio } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { Organization } from "@metriport/core/domain/organization";
import { Config, getEnvVarOrFail } from "../../shared/config";
import { isCWEnabledForCx } from "../aws/appConfig";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
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

type CWOrganizationWithOrgId = Omit<CWOrganization, "organizationId"> &
  Required<Pick<CWOrganization, "organizationId">>;

export async function organizationToCommonwell(
  org: Organization
): Promise<CWOrganizationWithOrgId> {
  const cwId = OID_PREFIX.concat(org.oid);
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
    memberName: Config.getCWMemberOrgName(),
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
  const { log, debug } = Util.out(`CW create - M oid ${org.oid}, id ${org.id}`);

  if (!(await isCWEnabledForCx(org.cxId))) {
    console.log(`CW disabled for cx ${org.cxId}, skipping CW org creation`);
    return undefined;
  }

  const cwOrg = await organizationToCommonwell(org);
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  try {
    const respCreate = await commonWell.createOrg(metriportQueryMeta, cwOrg);
    debug(`resp respCreate: `, JSON.stringify(respCreate));
    const respAddCert = await commonWell.addCertificateToOrg(
      metriportQueryMeta,
      getCertificate(),
      org.oid
    );
    debug(`resp respAddCert: `, JSON.stringify(respAddCert));

    // update the CQ bridge include list
    await initCQOrgIncludeList(org.oid);
  } catch (error) {
    const msg = `Failure creating Org @ CW`;
    log(msg, error);
    capture.message(msg, {
      extra: {
        orgId: org.id,
        orgOID: org.oid,
        cwReference: commonWell.lastReferenceHeader,
        context: `cw.org.create`,
        payload: cwOrg,
      },
      level: "error",
    });
    throw error;
  }
};

export const update = async (org: Organization): Promise<void> => {
  const { log, debug } = Util.out(`CW update - M oid ${org.oid}, id ${org.id}`);

  if (!(await isCWEnabledForCx(org.cxId))) {
    debug(`CW disabled for cx ${org.cxId}, skipping...`);
    return undefined;
  }

  const cwOrg = await organizationToCommonwell(org);
  const commonWell = makeCommonWellAPI(Config.getCWMemberOrgName(), Config.getCWMemberOID());
  try {
    const respUpdate = await commonWell.updateOrg(metriportQueryMeta, cwOrg, cwOrg.organizationId);
    debug(`resp respUpdate: `, JSON.stringify(respUpdate));

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const extra = {
      orgId: org.id,
      orgOID: org.oid,
      cwReference: commonWell.lastReferenceHeader,
      context: `cw.org.update`,
      error,
    };
    // Try to create the org if it doesn't exist
    if (error.response?.status === 404) {
      capture.message("Got 404 when updating Org @ CW, creating it", { extra });
      return create(org);
    }
    // General error handling
    const msg = `Failure updating Org @ CW`;
    log(msg, error);
    capture.message(msg, { extra: { ...extra, payload: cwOrg }, level: "error" });
    throw error;
  }
};

export async function initCQOrgIncludeList(orgOID: string): Promise<void> {
  try {
    const managementApi = makeCommonWellManagementAPI();
    if (!managementApi) {
      console.log(`Not linking org ${orgOID} to CQ Bridge b/c no managementAPI is available`);
      return;
    }
    const highPrioOrgs = getOrgsByPrio().high;
    const cqOrgIds = highPrioOrgs.map(o => o.id);
    const cqOrgIdsLimited =
      cqOrgIds.length > MAX_HIGH_PRIO_ORGS ? cqOrgIds.slice(0, MAX_HIGH_PRIO_ORGS) : cqOrgIds;
    console.log(
      `Updating CQ include list for org ${orgOID} with ${cqOrgIdsLimited.length} high prio orgs`
    );
    await managementApi.updateIncludeList({ oid: orgOID, careQualityOrgIds: cqOrgIdsLimited });
  } catch (error) {
    const additional = { orgOID, error, context: `initCQOrgIncludeList` };
    const msg = `Error while updating CQ include list`;
    console.log(`${msg}. Cause: ${additional}`);
    capture.message(msg, {
      extra: additional,
      level: "error",
    });
  }
}
