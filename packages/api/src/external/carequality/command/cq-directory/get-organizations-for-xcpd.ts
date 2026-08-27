import { buildDayjs } from "@metriport/shared/common/date";
import { CQDirectoryEntry } from "../../cq-directory";
import {
  getRecordLocatorServiceOrganizations,
  getStandaloneOrganizations,
  getSublinkOrganizations,
} from "./cq-gateways";
import { reportCqDirectorySearchDuration } from "./metrics";

function sortOrgsByNearbyOrder(orgs: CQDirectoryEntry[], orderMap: Map<string, number>) {
  return orgs.sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    return orderA - orderB;
  });
}

export async function getOrganizationsForXCPD(
  nearbyOrgOrderMap: Map<string, number>
): Promise<CQDirectoryEntry[]> {
  const startedAt = buildDayjs().toDate();
  const [rlsAndEhex, sublinks, standalone] = await Promise.all([
    getRecordLocatorServiceOrganizations(),
    getSublinkOrganizations(),
    getStandaloneOrganizations(),
  ]);
  reportCqDirectorySearchDuration(startedAt, "getOrganizationsForXcpdTotal");

  const sortedSublinks = sortOrgsByNearbyOrder(sublinks, nearbyOrgOrderMap);
  const sortedStandalone = sortOrgsByNearbyOrder(standalone, nearbyOrgOrderMap);

  return [...rlsAndEhex, ...sortedSublinks, ...sortedStandalone];
}
