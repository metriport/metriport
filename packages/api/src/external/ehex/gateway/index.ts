import { isEpicEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { OIDNode } from "@metriport/core/domain/oid";
import { Patient } from "@metriport/core/domain/patient";
import { EhexOidNode } from "@metriport/core/external/ehex/ehex-gateway/constants";
import { capture } from "@metriport/core/util";
import { out } from "@metriport/core/util/log";
import { XCPDGateway } from "@metriport/ihe-gateway-sdk";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../../shared/config";
import { isE2eCx } from "../../feature-flags";
import { getActiveOrgsForXcpdByPatient } from "../command/directory/ehex-gateways";
import { getEhexDirectoryEntryOrFail } from "../command/directory/get-ehex-directory-entry";
import {
  filterEhexOrgsToSearch,
  toBasicOrgAttributes,
} from "../command/directory/search-ehex-directory";
import { EhexDirectoryEntry } from "../ehex-directory";
import { buildXcpdGateway, ehexOrgsToXCPDGateways } from "../organization-conversion";

export const EPIC_ORG_NAME = "Epic";

export async function getGroupedQueryGateways(): Promise<XCPDGateway[]> {
  const HUB_GROUPED_QUERY_URL = Config.getEhexHubGroupedQueryUrl();
  if (!HUB_GROUPED_QUERY_URL) {
    capture.error("Hub grouped query URL not found", {
      extra: {
        HUB_GROUPED_QUERY_URL,
      },
    });
    throw new MetriportError("Hub grouped query URL not found");
  }

  return [
    buildXcpdGateway({
      urlXcpd: HUB_GROUPED_QUERY_URL,
      id: buildEhexGroupedQueryGatewayOid(HUB_GROUPED_QUERY_URL),
    }),
  ];
}

export function buildEhexGroupedQueryGatewayOid(url: string): string {
  const isGeoStateQuery = url.toLowerCase().includes("geostate");
  const oidSuffix = isGeoStateQuery ? EhexOidNode.hub_geo_state_query : EhexOidNode.hub_hrr_query;

  return `${Config.getSystemRootOID()}.${OIDNode.ehex_hub_gateway}.${oidSuffix}`;
}

export function isEhexGroupedQueryGatewayOid(oid: string): boolean {
  return oid.startsWith(Config.getSystemRootOID() + "." + OIDNode.ehex_hub_gateway + ".");
}

export async function gatherXCPDGateways(patient: Patient): Promise<XCPDGateway[]> {
  const { log } = out(`gatherXCPDGateways, cx ${patient.cxId}, patient ${patient.id}`);

  /**
   * This is dedicated to E2E testing: limits the XCPD to the System Root's E2E Gateway.
   * Avoid this approach as much as possible.
   */
  const isE2e = await isE2eCx(patient.cxId);
  if (isE2e) {
    log("Limiting to E2E Gateways");
    return getE2eGateways();
  }

  // TODO: 1582 - This logic will likely need to be updated once we have an idea of what the directory looks like on eHex.
  const isEpicEnabled = await isEpicEnabledForCx(patient.cxId);

  const allOrgs = await getActiveOrgsForXcpdByPatient(patient);
  const filteredOrgs = facilitiesWithEpicFilter(allOrgs, isEpicEnabled);
  const allOrgsWithBasicAttributes = filteredOrgs.map(toBasicOrgAttributes);
  const orgsToSearch = filterEhexOrgsToSearch(allOrgsWithBasicAttributes);
  const v2Gateways = await ehexOrgsToXCPDGateways(orgsToSearch);

  return v2Gateways;
}

export function facilitiesWithEpicFilter(
  ehexDirectoryEntries: EhexDirectoryEntry[],
  isEpicEnabled: boolean
): EhexDirectoryEntry[] {
  return isEpicEnabled
    ? ehexDirectoryEntries
    : ehexDirectoryEntries.filter(
        entry => entry.rootOrganization?.trim().toLowerCase() !== EPIC_ORG_NAME.toLowerCase()
      );
}

async function getE2eGateways(): Promise<XCPDGateway[]> {
  const e2eEhexDirectoryEntry = await getEhexDirectoryEntryOrFail(Config.getSystemRootOID());
  if (!e2eEhexDirectoryEntry.urlXcpd) {
    throw new MetriportError("E2E Ehex Directory entry missing XCPD URL", undefined, {
      id: e2eEhexDirectoryEntry.id,
    });
  }
  const e2eXcpdGateway = buildXcpdGateway({
    urlXcpd: e2eEhexDirectoryEntry.urlXcpd,
    id: e2eEhexDirectoryEntry.id,
  });
  return [e2eXcpdGateway];
}
