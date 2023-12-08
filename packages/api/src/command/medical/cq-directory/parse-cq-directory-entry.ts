import {
  ORG_POSITION,
  TRANSACTION_URL,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
} from "@metriport/carequality-sdk/common/util";
import { Address } from "@metriport/carequality-sdk/models/address";
import { Contained } from "@metriport/carequality-sdk/models/contained";
import { Organization } from "@metriport/carequality-sdk/models/organization";
import { Coordinates } from "@metriport/core/external/aws/location";
import { normalizeOid } from "@metriport/shared";
import { CQDirectoryEntryData } from "../../../domain/medical/cq-directory";

const EARTH_RADIUS = 6378168;

export type XCUrls = {
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
};

export function parseCQDirectoryEntries(orgsInput: Organization[]): CQDirectoryEntryData[] {
  const parsedOrgs = orgsInput.flatMap(org => {
    if (!org) return [];

    const normalizedOid = getOid(org);
    if (!normalizedOid) return [];

    const url = getUrls(org.contained);
    if (!url?.urlXCPD) return [];

    const coordinates = org.address ? getCoordinates(org.address) : undefined;
    const lat = coordinates ? coordinates.lat : undefined;
    const lon = coordinates ? coordinates.lon : undefined;
    const point = lat && lon ? computeEarthPoint(lat, lon) : undefined;

    const state = getState(org.address);

    const orgData: CQDirectoryEntryData = {
      id: normalizedOid,
      name: org.name?.value ?? undefined,
      urlXCPD: url.urlXCPD,
      urlDQ: url.urlDQ,
      urlDR: url.urlDR,
      lat,
      lon,
      point,
      state,
      data: org,
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

function getUrls(contained: Contained): XCUrls | undefined {
  const endpointMap: Record<string, string> = {};

  contained?.forEach(c => {
    const ext = c?.Endpoint.extension.extension.find(ext => ext.url === TRANSACTION_URL);
    const type = ext?.valueString?.value;

    if (type && c?.Endpoint?.address?.value) {
      endpointMap[type] = c.Endpoint.address.value;
    }
  });

  const urlXCPD = endpointMap[XCPD_STRING];

  if (!urlXCPD) return;

  const urls: XCUrls = {
    urlXCPD,
  };

  if (endpointMap[XCA_DQ_STRING]) {
    urls.urlDQ = endpointMap[XCA_DQ_STRING];
  }
  if (endpointMap[XCA_DR_STRING]) {
    urls.urlDR = endpointMap[XCA_DR_STRING];
  }

  return urls;
}

function getCoordinates(address: Address[]): Coordinates | undefined {
  const orgPosition = address.find(a => a.extension?.url === ORG_POSITION);
  const position = orgPosition?.extension?.valueCodeableConcept?.coding?.value?.position;
  if (!position) return;
  const lat = parseFloat(position.latitude.value);
  const lon = parseFloat(position.longitude.value);
  if (isNaN(lat) || isNaN(lon)) return;
  if (lat < -90 || lat > 90) return;
  if (lon < -180 || lon > 180) return;
  return { lat, lon };
}

function getState(addresses: Address[] | undefined): string | undefined {
  if (!addresses) return;
  if (addresses.length > 0 && addresses[0].state) return addresses[0].state.value ?? undefined;
  return;
}

function getOid(org: Organization): string | undefined {
  const oid = org?.identifier?.value?.value;
  if (!oid) return;
  try {
    return normalizeOid(oid);
  } catch (err) {
    console.log(`Organization ${org?.name?.value} has invalid OID: ${oid}`);
  }
}
