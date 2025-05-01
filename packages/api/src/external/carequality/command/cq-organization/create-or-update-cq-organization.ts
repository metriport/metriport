import { CarequalityManagementApi } from "@metriport/carequality-sdk";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { makeCarequalityManagementApiOrFail } from "../../api";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQOrgDetails, CQOrgDetailsWithUrls, getCqAddress, getCqOrgUrls } from "../../shared";
import { getOrganizationFhirTemplate } from "./organization-template";
import { parseCQOrganization } from "./parse-cq-organization";

type CqOrgDetailsLean = Omit<
  CQOrgDetails,
  "addressLine1" | "city" | "state" | "postalCode" | "lat" | "lon"
>;

type BasicCqOrgDetails = {
  cxId: string;
  oid: string;
  name: string;
  address: AddressStrict;
};

export type CreateOrUpdateCqOrganizationCmd = CqOrgDetailsLean & BasicCqOrgDetails;

/**
 * Creates or updates a Carequality organization (it can be a Metriport Organization or Facility).
 */
export async function createOrUpdateCqOrganization(
  cmd: CreateOrUpdateCqOrganizationCmd
): Promise<CQDirectoryEntryData> {
  const cq = makeCarequalityManagementApiOrFail();
  const [cqOrg, orgDetailsWithUrls] = await Promise.all([
    cq.getOrganization(cmd.oid),
    cmdToCqOrgDetails(cmd),
  ]);
  if (cqOrg) return await updateCqOrganization(orgDetailsWithUrls, cq);
  return await createCqOrganization(orgDetailsWithUrls, cq);
}

export async function cmdToCqOrgDetails(
  cmd: CreateOrUpdateCqOrganizationCmd
): Promise<CQOrgDetailsWithUrls> {
  const { cxId, oid, name, address } = cmd;
  const { coordinates, addressLine } = await getCqAddress({ cxId, address });
  const orgDetailsWithUrls: CQOrgDetailsWithUrls = {
    ...cmd,
    ...getCqOrgUrls(),
    oid,
    name,
    addressLine1: addressLine,
    city: address.city,
    state: address.state,
    postalCode: address.zip,
    lat: coordinates.lat.toString(),
    lon: coordinates.lon.toString(),
  };
  return orgDetailsWithUrls;
}

async function updateCqOrganization(
  orgDetails: CQOrgDetailsWithUrls,
  cq: CarequalityManagementApi
): Promise<CQDirectoryEntryData> {
  const { log, debug } = out(`CQ updateCQOrganization - CQ Org OID ${orgDetails.oid}`);
  const carequalityOrg = getOrganizationFhirTemplate(orgDetails);
  try {
    const resp = await cq.updateOrganization(carequalityOrg);
    debug(`resp updateOrganization: `, () => JSON.stringify(resp));
    return parseCQOrganization(resp);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const extra = {
      orgOid: orgDetails.oid,
      context: `cq.org.update`,
      carequalityOrg,
      error,
    };
    if (error.response?.status === 404) {
      const msg = "Got 404 while updating Org @ CQ, creating it";
      log(`${msg}. Org OID: ${orgDetails.oid}`);
      capture.message(msg, { extra });
      return await createCqOrganization(orgDetails, cq);
    }
    const msg = `Failure while updating org @ CQ`;
    log(`${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, { extra });
    throw error;
  }
}

async function createCqOrganization(
  orgDetails: CQOrgDetailsWithUrls,
  cq: CarequalityManagementApi
): Promise<CQDirectoryEntryData> {
  const { log, debug } = out(`CQ registerOrganization - CQ Org OID ${orgDetails.oid}`);
  const carequalityOrg = getOrganizationFhirTemplate(orgDetails);
  try {
    const resp = await cq.registerOrganization(carequalityOrg);
    debug(`resp registerOrganization: `, () => JSON.stringify(resp));
    return parseCQOrganization(resp);
  } catch (error) {
    const msg = `Failure while registering org @ CQ`;
    log(`${msg}. Org OID: ${orgDetails.oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: orgDetails.oid,
        context: `cq.org.create`,
        carequalityOrg,
        error,
      },
    });
    throw error;
  }
}
