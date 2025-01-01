import { getOrganizationIdsNotManagedBy } from "../carequality/command/cq-directory/cq-gateways";

/**
 * Returns the list of Org OIDs that are not allowed to be used on CW.
 */
export async function getCqOrgIdsToDenyOnCw() {
  return getOrganizationIdsNotManagedBy(["CommonWell"]);
}
