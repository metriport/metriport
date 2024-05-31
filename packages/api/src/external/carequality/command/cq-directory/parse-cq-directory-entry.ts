import { ORG_POSITION, TRANSACTION_URL } from "@metriport/carequality-sdk/common/util";
import { Address } from "@metriport/carequality-sdk/models/address";
import { Contained } from "@metriport/carequality-sdk/models/contained";
import { ManagingOrganization, Organization } from "@metriport/carequality-sdk/models/organization";
import { Coordinates } from "@metriport/core/external/aws/location";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, normalizeOid, normalizeZipCode } from "@metriport/shared";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQOrgUrls } from "../../shared";
import { out } from "@metriport/core/util/log";

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
type ChannelUrl = typeof XCPD_STRING | typeof XCA_DQ_STRING | typeof XCA_DR_STRING;

export function parseCQDirectoryEntries(orgsInput: Organization[]): CQDirectoryEntryData[] {
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

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
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
        parsedAddress.zip = normalizeZipCode(postalCode);
      } catch (err) {
        log(`normalizeZipCode error for zip ${postalCode} - error: ${errorToString(err)}`);
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

function getOid(org: Organization): string | undefined {
  if (!org?.identifier || !org.name) return;
  return getNormalizedOid(org, `Organization ${org?.name?.value ?? ""}`);
}

function getManagingOrgId(org: Organization): string | undefined {
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
  const msg = `Unknown CQ Endpoint type`;
  log(msg);
  capture.message(msg, {
    extra: { value, context: "parseCQDirectoryEntries" },
    level: "warning",
  });
  return;
}
