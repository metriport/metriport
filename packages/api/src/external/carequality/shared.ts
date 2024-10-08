import { NotFoundError, errorToString, PurposeOfUse } from "@metriport/shared";
import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { Coordinates } from "@metriport/core/domain/address";
import { capture } from "@metriport/core/util/notifications";
import { MedicalDataSource } from "@metriport/core/external/index";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import z from "zod";
import { isCarequalityEnabled, isCQDirectEnabledForCx } from "../aws/app-config";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { getAddressWithCoordinates } from "../../domain/medical/address";
import { CQDirectoryEntryData } from "./cq-directory";
import { parseCQDirectoryEntries } from "./command/cq-directory/parse-cq-directory-entry";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export async function isCqEnabled(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId: string,
  forceEnabled: boolean,
  log: typeof console.log
): Promise<boolean> {
  const { cxId } = patient;

  try {
    const isCQEnabled = await isCarequalityEnabled();
    const isCQDirectEnabled = await isCQDirectEnabledForCx(cxId);
    const isCqQueryEnabled = await isFacilityEnabledToQueryCQ(facilityId, patient);

    const cqIsDisabled = !isCQEnabled && !forceEnabled;
    const cqDirectIsDisabledForCx = !isCQDirectEnabled;

    if (cqIsDisabled) {
      log(`CQ not enabled, skipping PD`);
      return false;
    } else if (cqDirectIsDisabledForCx) {
      log(`CQ disabled for cx ${cxId}, skipping PD`);
      return false;
    } else if (!isCqQueryEnabled) {
      log(`CQ querying not enabled for facility, skipping PD`);
      return false;
    }
    return true;
  } catch (error) {
    const msg = `Error validating PD enabled`;
    log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        forceEnabled,
        error,
      },
    });
  }
  return false;
}

export const cqOrgUrlsSchema = z.object({
  urlXCPD: z.string().optional(),
  urlDQ: z.string().optional(),
  urlDR: z.string().optional(),
});

export type CQOrgUrls = z.infer<typeof cqOrgUrlsSchema>;

export const cqOrgDetailsSchema = z.object({
  name: z.string(),
  oid: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  lat: z.string(),
  lon: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  role: z.enum(["Implementer", "Connection"]),
  active: z.boolean(),
  organizationBizType: z.nativeEnum(OrganizationBizType).optional(),
  parentOrgOid: z.string().optional(),
});

export const cqOrgDetailsOrgBizRequiredSchema = cqOrgDetailsSchema.required({
  organizationBizType: true,
});

export type CQOrgDetails = z.infer<typeof cqOrgDetailsSchema>;
export type CQOrgDetailsWithUrls = CQOrgDetails & CQOrgUrls;

export function formatDate(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined;
  const preprocessedDate = dateString.replace(/[-:]/g, "");
  const year = preprocessedDate.slice(0, 4);
  const month = preprocessedDate.slice(4, 6);
  const day = preprocessedDate.slice(6, 8);
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const date = new Date(formattedDate);
    return date.toISOString();
  } catch (error) {
    const msg = "Error creating date object for document reference";
    console.log(`${msg}: ${error}`);
  }

  return undefined;
}

export async function getCqInitiator(
  patient: Pick<Patient, "id" | "cxId">,
  facilityId?: string
): Promise<HieInitiator> {
  return getHieInitiator(patient, facilityId);
}

export async function isFacilityEnabledToQueryCQ(
  facilityId: string | undefined,
  patient: Pick<Patient, "id" | "cxId">
): Promise<boolean> {
  return await isHieEnabledToQuery(facilityId, patient, MedicalDataSource.CAREQUALITY);
}

export function getSystemUserName(orgName: string): string {
  return `${orgName} System User`;
}

export function buildCqOrgNameForFacility({
  vendorName,
  orgName,
  oboOid,
}: {
  vendorName: string;
  orgName: string;
  oboOid: string | undefined;
}): string {
  if (oboOid) {
    return `${vendorName} - ${orgName} #OBO# ${oboOid}`;
  }

  return `${vendorName} - ${orgName}`;
}

export async function getCqAddress({
  cxId,
  address,
}: {
  cxId: string;
  address: AddressStrict;
}): Promise<{ coordinates: Coordinates; addressLine: string }> {
  const { coordinates } = await getAddressWithCoordinates(address, cxId);
  const addressLine = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;
  return { coordinates, addressLine };
}

export const cqOrgActiveSchema = z.object({
  active: z.boolean(),
});

export async function getParsedCqOrgOrFail(
  cq: CarequalityManagementAPI,
  oid: string,
  active: boolean
): Promise<CQDirectoryEntryData> {
  const resp = await cq.listOrganizations({ count: 1, oid, active });
  if (resp.length === 0) throw new NotFoundError("Organization not found");
  const cqOrgs = parseCQDirectoryEntries(resp);
  const cqOrg = cqOrgs[0] as CQDirectoryEntryData;
  if (cqOrgs.length > 1) {
    capture.message("More than one organization with the same OID found in the CQ directory", {
      extra: {
        orgOid: oid,
        context: `cq.org.directory`,
      },
    });
  }
  return cqOrg;
}
