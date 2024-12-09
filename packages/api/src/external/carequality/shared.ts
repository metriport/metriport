import { NotFoundError, errorToString } from "@metriport/shared";
import { CarequalityManagementAPIFhir } from "@metriport/carequality-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { Coordinates } from "@metriport/core/domain/address";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import { PurposeOfUse } from "@metriport/shared";
import { MedicalDataSource } from "@metriport/core/external/index";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import z from "zod";
import { isCarequalityEnabled, isCQDirectEnabledForCx } from "../aws/app-config";
import { getHieInitiator, HieInitiator, isHieEnabledToQuery } from "../hie/get-hie-initiator";
import { getAddressWithCoordinates } from "../../domain/medical/address";
import { CQDirectoryEntryData } from "./cq-directory";
import { parseCQDirectoryEntryFromCqOrgDetailsWithUrls } from "./command/cq-directory/parse-cq-directory-entry";
import { MetriportError } from "@metriport/shared";
import { Organization } from "@medplum/fhirtypes";
// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
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

export function parseFhirOrganization(org: Organization): CQOrgDetailsWithUrls {
  const name = org.name;
  if (!name) throw new MetriportError("CQ Organization missing name");
  const oid = org.identifier?.[0]?.value;
  if (!oid) throw new MetriportError("CQ Organization missing OID", undefined, { name });
  const address = org.address?.[0];
  if (!address) throw new MetriportError("CQ Organization missing address", undefined, { oid });
  const addressLine1 = address.line?.[0];
  const city = address.city;
  const state = address.state;
  const postalCode = address.postalCode;
  const location = org.contained?.filter(c => c.resourceType === "Location");
  const lat = location?.[0]?.position?.latitude;
  const lon = location?.[0]?.position?.longitude;
  if (!addressLine1 || !city || !state || !postalCode || !lat || !lon) {
    throw new MetriportError("CQ Organization has partial address", undefined, {
      oid,
      addressLine1,
      city,
      state,
      postalCode,
      lat,
      lon,
    });
  }
  const contact = org.contact?.[0];
  if (!contact) throw new MetriportError("CQ Organization missing contact", undefined, { oid });
  const contactName = contact.name?.text;
  if (!contactName)
    throw new MetriportError("CQ Organization missing contactName", undefined, { oid });
  const phone = contact.telecom?.filter(t => t.system === "phone")[0]?.value;
  if (!phone) throw new MetriportError("CQ Organization missing phone", undefined, { oid });
  const email = contact.telecom?.filter(t => t.system === "email")[0]?.value;
  if (!email) throw new MetriportError("CQ Organization missing email", undefined, { oid });
  const role = org.type?.[0]?.coding?.[0]?.code;
  if (!role) throw new MetriportError("CQ Organization missing role", undefined, { oid });
  if (role !== "Implementer" && role !== "Connection")
    throw new MetriportError("CQ Organization invalid role", undefined, { oid });
  const active = org.active;
  if (active === undefined)
    throw new MetriportError("CQ Organization missing active", undefined, { oid });
  const parentOrg = org.partOf?.reference;
  if (!parentOrg) throw new MetriportError("CQ Organization missing parentOrg", undefined, { oid });
  const parentOrgOid = parentOrg.split("/")[1];
  return {
    name,
    oid,
    addressLine1,
    city,
    state,
    postalCode,
    lat: lat.toString(),
    lon: lon.toString(),
    contactName,
    phone,
    email,
    role,
    active,
    urlXCPD: undefined,
    urlDQ: undefined,
    urlDR: undefined,
    parentOrgOid,
  };
}

export async function getParsedCqOrgOrFail(
  cq: CarequalityManagementAPIFhir,
  oid: string
): Promise<CQDirectoryEntryData> {
  const org = await getCqOrgOrFail(cq, oid);
  return parseCQDirectoryEntryFromCqOrgDetailsWithUrls(org);
}

export async function getCqOrgOrFail(
  cq: CarequalityManagementAPIFhir,
  oid: string
): Promise<CQOrgDetails> {
  const org = await getCqOrg(cq, oid);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}

export async function getCqOrg(
  cq: CarequalityManagementAPIFhir,
  oid: string
): Promise<CQOrgDetails | undefined> {
  const { log } = out(`CQ getCqOrg - CQ Org OID ${oid}`);

  try {
    const orgs = await cq.listOrganizations({ oid });
    const org = orgs[0];
    return org ? parseFhirOrganization(org) : undefined;
  } catch (error) {
    const msg = `Failure while getting Org @ CQ`;
    log(`${msg}. Org OID: ${oid}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        orgOid: oid,
        context: `cq.org.get`,
        error,
      },
    });
    throw error;
  }
}
