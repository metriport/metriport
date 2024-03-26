import { CQDirectoryEntryModel } from "../../models/cq-directory";
import {
  getRecordLocatorServiceOrganizations,
  getStandaloneOrganizations,
  getSublinkOrganizations,
} from "./cq-gateways";

function sortOrgsByNearbyOrder(orgs: CQDirectoryEntryModel[], orderMap: Map<string, number>) {
  return orgs.sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    return orderA - orderB;
  });
}

export async function getOrganizationsForXCPD(
  nearbyOrgOrderMap: Map<string, number>
): Promise<CQDirectoryEntryModel[]> {
  const [rlsAndEhex, sublinks, standalone] = await Promise.all([
    getRecordLocatorServiceOrganizations(),
    getSublinkOrganizations(),
    getStandaloneOrganizations(),
  ]);

  const sortedSublinks = sortOrgsByNearbyOrder(sublinks, nearbyOrgOrderMap);
  const sortedStandalone = sortOrgsByNearbyOrder(standalone, nearbyOrgOrderMap);

  return [...rlsAndEhex, ...sortedSublinks, ...sortedStandalone];
}
