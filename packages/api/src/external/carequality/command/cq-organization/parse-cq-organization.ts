import { Endpoint, Organization } from "@medplum/fhirtypes";
import { isEndpoint, isLocation } from "@metriport/core/external/fhir/shared/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  isValidUrl,
  MetriportError,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
} from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import stringify from "json-stringify-safe";
import { CQDirectoryEntryData } from "../../cq-directory";
import { CQOrgUrls } from "../../shared";
import { getCqOrg } from "./get-cq-organization";
import { transactionUrl } from "./organization-template";

const EARTH_RADIUS = 6378168;
const XCPD_STRING = "ITI-55";
const XCA_DQ_STRING = "ITI-38";
const XCA_DR_STRING = "ITI-39";
const XDR_STRING = "ITI-41";
type ChannelUrl = typeof XCPD_STRING | typeof XCA_DQ_STRING | typeof XCA_DR_STRING;

export async function parseCQOrganization(org: Organization): Promise<CQDirectoryEntryData> {
  const { log } = out(`parseCQOrganization`);

  const id = org.identifier?.[0]?.value;
  if (!id) throw new MetriportError("Missing ID on CQ Org", undefined, { org: stringify(org) });

  const active = org.active;
  if (active == undefined) {
    throw new MetriportError("Missing active on CQ Org", undefined, { org: stringify(org) });
  }

  if (!org.meta?.lastUpdated) log("Missing lastUpdated at CQ Org, using current timestamp");
  const lastUpdatedAtCQ = org.meta?.lastUpdated ?? buildDayjs().toISOString();

  const address = org.address?.[0];
  const addressLine = address?.line?.[0];
  const city = address?.city;
  const state = address?.state;
  const postalCode = address?.postalCode;

  const location = org.contained?.filter(isLocation);
  const lat = location?.[0]?.position?.latitude;
  const lon = location?.[0]?.position?.longitude;
  const point = lat && lon ? computeEarthPoint(lat, lon) : undefined;

  const parentOrg = org.partOf?.reference ?? org.partOf?.identifier?.value;
  const parentOrgOid = parentOrg?.split("/")[1];
  let parentOrgName: string | undefined;
  if (parentOrgOid) {
    const parentOrg = await getCqOrg(parentOrgOid);
    if (parentOrg) parentOrgName = parentOrg.name;
  }

  const endpoints: Endpoint[] = org.contained?.filter(isEndpoint) ?? [];

  return {
    id,
    name: org.name,
    lat: lat,
    lon: lon,
    point,
    addressLine,
    city,
    state: state ? normalizeUSStateForAddressSafe(state) : undefined,
    zip: postalCode ? normalizeZipCodeNewSafe(postalCode) : undefined,
    managingOrganization: parentOrgName,
    managingOrganizationId: parentOrgOid,
    active,
    lastUpdatedAtCQ,
    ...getUrls(endpoints),
  };
}

/**
 * Computes the Earth point for a coordinate pair. Built based on this logic: https://github.com/postgres/postgres/blob/4d0cf0b05defcee985d5af38cb0db2b9c2f8dbae/contrib/earthdistance/earthdistance--1.1.sql#L50-L55C15
 * @returns Earth 3D point
 */
function computeEarthPoint(lat: number, lon: number): string {
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

function getUrls(endpoints: Endpoint[]): CQOrgUrls {
  const endpointMap: Record<string, string> = {};

  endpoints.forEach(endpoint => {
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

function getUrlType(value: string | undefined): ChannelUrl | undefined {
  const { log } = out(`getUrlType`);
  if (!value) return;
  if (value.includes(XCPD_STRING)) return XCPD_STRING;
  if (value.includes(XCA_DQ_STRING)) return XCA_DQ_STRING;
  if (value.includes(XCA_DR_STRING)) return XCA_DR_STRING;

  if (value.includes("Direct Messaging")) return;
  if (value.includes(XDR_STRING)) return; // TODO: #2468 - Learn about the function of this endpoint and see whether we need to include it in our mapping

  const msg = `Unknown CQ Endpoint type`;
  log(msg);
  capture.message(msg, {
    extra: { value, context: "getUrlType" },
    level: "warning",
  });
  return;
}
