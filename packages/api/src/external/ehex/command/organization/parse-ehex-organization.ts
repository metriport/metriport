import { Endpoint, Extension, Organization } from "@medplum/fhirtypes";
// TODO 1588 Decouple this from Carequality
import { isDoaExtension } from "@metriport/core/external/carequality/extension";
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
import {
  TransactionType,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
  XDR_STRING,
} from "@metriport/shared/external/ihe/constants";
import stringify from "json-stringify-safe";
import { EhexOrgUrls } from "../../shared";
import { EhexDirectoryEntryData } from "../../ehex-directory";
import { CachedEhexOrgLoader } from "./get-ehex-organization-cached";
import { getParentOid } from "./get-parent-org";
import { makeEhexManagementApiOrFail } from "../../api";

// TODO: 1582 - Verify these links when we have access to the directory.
export const TRANSACTIONAL_URL =
  "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Transaction";
const EARTH_RADIUS = 6378168;
type ChannelUrl = TransactionType;

export async function parseEhexOrganization(
  org: Organization,
  cache?: CachedEhexOrgLoader
): Promise<EhexDirectoryEntryData> {
  const { log } = out(`parseEhexOrganization`);
  const ehexCache = cache ?? new CachedEhexOrgLoader(await makeEhexManagementApiOrFail());

  const id = org.id ?? org.identifier?.[0]?.value;
  if (!id) throw new MetriportError("Missing ID on Ehex Org", undefined, { org: stringify(org) });

  const active = org.active;
  if (active == undefined) {
    throw new MetriportError("Missing active on Ehex Org", undefined, { org: stringify(org) });
  }

  const lastUpdatedAtEhexRaw = org.meta?.lastUpdated;
  if (!lastUpdatedAtEhexRaw) log("Missing lastUpdated at Ehex Org, using current timestamp");
  const lastUpdatedAtEhex = lastUpdatedAtEhexRaw ?? buildDayjs().toISOString();

  const address = org.address?.[0];
  const addressLine = address?.line?.[0];
  const city = address?.city;
  const state = address?.state;
  const postalCode = address?.postalCode;

  const location = org.contained?.filter(isLocation);
  const lat = location?.[0]?.position?.latitude;
  const lon = location?.[0]?.position?.longitude;
  const point = lat && lon ? computeEarthPoint(lat, lon) : undefined;

  const parentOrgOid = getParentOid(org);
  const rootOrgName = await getRootForOrg(org, ehexCache, log);

  const endpoints: Endpoint[] = org.contained?.filter(isEndpoint) ?? [];

  const delegateOids = getDelegateOids(org.extension);

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
    rootOrganization: rootOrgName,
    managingOrganizationId: parentOrgOid,
    active,
    lastUpdatedAtEhex,
    data: org,
    delegateOids,
    ...getUrls(endpoints),
  };
}

async function getRootForOrg(
  org: Organization,
  cache: CachedEhexOrgLoader,
  log: typeof console.log
): Promise<string | undefined> {
  const parentOrgOid = getParentOid(org);
  if (!parentOrgOid) return org.name;
  if (parentOrgOid === org.id) return org.name;

  const parentOrg = await cache.getEhexOrg(parentOrgOid);
  if (!parentOrg) {
    log(`No Org found for parent OID ${parentOrgOid}, returning the OID`);
    return parentOrgOid;
  }
  return getRootForOrg(parentOrg, cache, log);
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

function getUrls(endpoints: Endpoint[]): EhexOrgUrls {
  const endpointMap: Record<string, string> = {};

  endpoints.forEach(endpoint => {
    const ext = endpoint.extension?.find(ext => ext.url === TRANSACTIONAL_URL);
    const type = getUrlType(ext?.valueCodeableConcept?.coding?.[0]?.code);
    const address = endpoint.address;

    if (type && address) endpointMap[type] = address;
  });

  const urls: EhexOrgUrls = {};
  const urlXcpd = endpointMap[XCPD_STRING];
  const urlDq = endpointMap[XCA_DQ_STRING];
  const urlDr = endpointMap[XCA_DR_STRING];
  // TODO: #1582 - Add urlXDR if needed

  if (isValidUrl(urlXcpd)) {
    urls.urlXcpd = urlXcpd;
  }
  if (isValidUrl(urlDq)) {
    urls.urlDq = urlDq;
  }
  if (isValidUrl(urlDr)) {
    urls.urlDr = urlDr;
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

  const msg = `Unknown Ehex Endpoint type`;
  log(msg);
  capture.message(msg, {
    extra: { value, context: "getUrlType" },
    level: "warning",
  });
  return;
}

function getDelegateOids(extensions: Extension[] | undefined): string[] {
  const delegateOids: string[] = [];

  extensions?.forEach(ext => {
    if (isDoaExtension(ext)) {
      const reference = ext.valueReference?.reference;
      if (!reference) return;
      const oid = reference.split("/")[1];
      oid && delegateOids.push(oid);
    }
  });

  return delegateOids;
}
