import { MetriportError } from "@metriport/shared";
import { Organization, Endpoint } from "@medplum/fhirtypes";
import { ORG_POSITION, TRANSACTION_URL } from "@metriport/carequality-sdk/common/util";
import { Address } from "@metriport/carequality-sdk/models/address";
import { Contained } from "@metriport/carequality-sdk/models/contained";
import {
  ManagingOrganization,
  Organization as OrganziationLegacy,
} from "@metriport/carequality-sdk/models/organization";
import { Coordinates } from "@metriport/core/external/aws/location";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, isValidUrl, normalizeOid, normalizeZipCodeNew } from "@metriport/shared";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQOrgUrls } from "../../shared";
import { transactionUrl } from "../../organization-fhir-template";
const { log } = out(`parseCQDirectoryEntries`);

export type LenientAddress = {
  addressLine?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  zip?: string | undefined;
};

const EARTH_RADIUS = 6378168;
const XCPD_STRING = "ITI-55";
const XCA_DQ_STRING = "ITI-38";
const XCA_DR_STRING = "ITI-39";
const XDR_STRING = "ITI-41";
type ChannelUrl = typeof XCPD_STRING | typeof XCA_DQ_STRING | typeof XCA_DR_STRING;

export function parseCQDirectoryEntries(orgsInput: OrganziationLegacy[]): CQDirectoryEntryData[] {
  const parsedOrgs = orgsInput.flatMap(org => {
    if (!org) return [];

    const normalizedOid = getOid(org);
    if (!normalizedOid) return [];

    const urls = getUrls(org.contained);
    const coordinates = org.address ? getCoordinates(org.address) : undefined;
    const lat = coordinates ? coordinates.lat : undefined;
    const lon = coordinates ? coordinates.lon : undefined;
    const point = lat && lon ? computeEarthPoint(lat, lon) : undefined;
    const managingOrganization = org.managingOrg ? getManagingOrg(org.managingOrg) : undefined;
    const managingOrganizationId = getManagingOrgId(org);
    const { addressLine, city, state, zip } = getAddressFields(org.address);
    const active = org.active?.value ?? false;

    const orgData: CQDirectoryEntryData = {
      id: normalizedOid,
      name: org.name?.value ?? undefined,
      urlXCPD: urls?.urlXCPD,
      urlDQ: urls?.urlDQ,
      urlDR: urls?.urlDR,
      lat,
      lon,
      point,
      addressLine,
      city,
      state,
      zip,
      data: org,
      managingOrganization,
      managingOrganizationId,
      active,
      lastUpdatedAtCQ: org.meta.lastUpdated.value,
    };
    return orgData;
  });

  return parsedOrgs;
}

export function parseCQDirectoryEntryFromFhirOrganization(org: Organization): CQDirectoryEntryData {
  const oid = org.identifier?.[0]?.value;
  if (!oid) throw new MetriportError("CQ Organization missing OID");
  const name = org.name;
  if (!name) throw new MetriportError("CQ Organization missing name", undefined, { oid });
  const address = org.address?.[0];
  if (!address) throw new MetriportError("CQ Organization missing address", undefined, { oid });
  const addressLine = address.line?.[0];
  const city = address.city;
  const state = address.state;
  const postalCode = address.postalCode;
  const location = org.contained?.filter(c => c.resourceType === "Location");
  const lat = location?.[0]?.position?.latitude;
  const lon = location?.[0]?.position?.longitude;
  if (!addressLine || !city || !state || !postalCode || !lat || !lon) {
    throw new MetriportError("CQ Organization has partial address", undefined, {
      oid,
      addressLine,
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
  const endpoints = org.contained?.filter(c => c.resourceType === "Endpoint") ?? [];

  const point = lat && lon ? computeEarthPoint(lat, lon) : undefined;
  return {
    id: oid,
    name,
    lat: lat,
    lon: lon,
    point,
    addressLine,
    city,
    state,
    zip: postalCode,
    managingOrganization: parentOrgOid,
    managingOrganizationId: parentOrgOid,
    active,
    lastUpdatedAtCQ: "TODO",
    ...getUrlsFhir(endpoints),
  };
}

/**
 * Computes the Earth point for a coordinate pair. Built based on this logic: https://github.com/postgres/postgres/blob/4d0cf0b05defcee985d5af38cb0db2b9c2f8dbae/contrib/earthdistance/earthdistance--1.1.sql#L50-L55C15
 * @returns Earth 3D point
 */
export function computeEarthPoint(lat: number, lon: number): string {
  const latRad = convertDegreesToRadians(lat);
  const lonRad = convertDegreesToRadians(lon);

  const x = EARTH_RADIUS * Math.cos(latRad) * Math.cos(lonRad);
  const y = EARTH_RADIUS * Math.cos(latRad) * Math.sin(lonRad);
  const z = EARTH_RADIUS * Math.sin(latRad);
  return `(${x},${y},${z})`;
}

function convertDegreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getUrls(contained: Contained): CQOrgUrls {
  const endpointMap: Record<string, string> = {};

  contained?.forEach(c => {
    const ext = c?.Endpoint.extension.extension.find(ext => ext.url === TRANSACTION_URL);
    const type = getUrlType(ext?.valueString?.value);

    if (type && c?.Endpoint?.address?.value) {
      endpointMap[type] = c.Endpoint.address.value;
    }
  });

  const urls: CQOrgUrls = {};
  const urlXCPD = endpointMap[XCPD_STRING];
  const urlDQ = endpointMap[XCA_DQ_STRING];
  const urlDR = endpointMap[XCA_DR_STRING];

  if (isValidUrl(urlXCPD)) {
    urls.urlXCPD = urlXCPD;
  }
  if (isValidUrl(urlDQ)) {
    urls.urlDQ = urlDQ;
  }
  if (isValidUrl(urlDR)) {
    urls.urlDR = urlDR;
  }

  return urls;
}

function getUrlsFhir(endpoints: Endpoint[]): CQOrgUrls {
  const endpointMap: Record<string, string> = {};

  endpoints.map(endpoint => {
    const ext = endpoint.extension?.find(ext => ext.url === transactionUrl);
    const type = getUrlType(ext?.valueCodeableConcept?.coding?.[0]?.code);
    const address = endpoint.address;

    if (type && address) endpointMap[type] = address;
  });

  const urls: CQOrgUrls = {};
  const urlXCPD = endpointMap[XCPD_STRING];
  const urlDQ = endpointMap[XCA_DQ_STRING];
  const urlDR = endpointMap[XCA_DR_STRING];

  if (isValidUrl(urlXCPD)) {
    urls.urlXCPD = urlXCPD;
  }
  if (isValidUrl(urlDQ)) {
    urls.urlDQ = urlDQ;
  }
  if (isValidUrl(urlDR)) {
    urls.urlDR = urlDR;
  }

  return urls;
}

function getCoordinates(address: Address[]): Coordinates | undefined {
  const addressArray = Array.isArray(address) ? address : [address];
  const orgPosition = addressArray.find(a => a.extension?.url === ORG_POSITION);
  const position = orgPosition?.extension?.valueCodeableConcept?.coding?.value?.position;
  if (!position) return;
  const lat = parseFloat(position.latitude.value);
  const lon = parseFloat(position.longitude.value);
  if (isNaN(lat) || isNaN(lon)) return;
  if (lat < -90 || lat > 90) return;
  if (lon < -180 || lon > 180) return;
  return { lat, lon };
}

export function getAddressFields(addresses: Address[] | undefined): LenientAddress {
  if (!addresses) return {};

  let bestAddress: LenientAddress = {};

  for (const address of addresses) {
    const parsedAddress: LenientAddress = {};

    if (address?.line) {
      const line = Array.isArray(address.line) ? address.line[0]?.value : address.line?.value;
      if (line) parsedAddress.addressLine = line;
    }
    if (address?.city?.value) parsedAddress.city = address?.city?.value;
    if (address?.state?.value) parsedAddress.state = address?.state?.value;
    const postalCode = address?.postalCode?.value;
    if (postalCode && postalCode.length > 0) {
      try {
        parsedAddress.zip = normalizeZipCodeNew(postalCode);
      } catch (err) {
        log(`normalizeZipCodeNew error for zip ${postalCode} - error: ${errorToString(err)}`);
      }
    }

    if (
      parsedAddress.addressLine &&
      parsedAddress.city &&
      parsedAddress.state &&
      parsedAddress.zip
    ) {
      return parsedAddress;
    }

    if (Object.keys(parsedAddress).length > Object.keys(bestAddress).length) {
      bestAddress = parsedAddress;
    }
  }

  return bestAddress;
}

function getManagingOrg(managingOrg: ManagingOrganization | undefined): string | undefined {
  const parts = managingOrg?.reference?.value?.split("/");
  return parts ? parts[parts.length - 1] : undefined;
}

function getOid(org: OrganziationLegacy): string | undefined {
  if (!org?.identifier || !org.name) return;
  return getNormalizedOid(org, `Organization ${org?.name?.value ?? ""}`);
}

function getManagingOrgId(org: OrganziationLegacy): string | undefined {
  if (!org?.partOf) return;
  const name = org?.name?.value ?? undefined;
  return getNormalizedOid(org.partOf, `Managing Organization ${name ? "of " + name : ""}`);
}

type IdentifiableEntity = {
  identifier?: {
    value?: {
      value?: string;
    };
  };
};

function getNormalizedOid(
  entity: IdentifiableEntity,
  entityDescription: string
): string | undefined {
  const oid = entity?.identifier?.value?.value;
  if (!oid) return;
  try {
    return normalizeOid(oid);
  } catch (err) {
    log(`${entityDescription} has invalid OID: ${oid}`);
  }
}

function getUrlType(value: string | undefined): ChannelUrl | undefined {
  if (!value) return;
  if (value.includes(XCPD_STRING)) return XCPD_STRING;
  if (value.includes(XCA_DQ_STRING)) return XCA_DQ_STRING;
  if (value.includes(XCA_DR_STRING)) return XCA_DR_STRING;

  if (value.includes("Direct Messaging")) return;
  if (value.includes(XDR_STRING)) return; // TODO: #2468 - Learn about the function of this endpoint and see whether we need to include it in our mapping

  const msg = `Unknown CQ Endpoint type`;
  log(msg);
  capture.message(msg, {
    extra: { value, context: "parseCQDirectoryEntries" },
    level: "warning",
  });
  return;
}
