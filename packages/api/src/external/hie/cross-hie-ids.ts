import { getOrganizationIdsNotManagedBy } from "../carequality/command/cq-directory/get-cq-directory-organization";

/**
 * Returns the list of Org OIDs that are not allowed to be used on CW.
 */
export async function getCqOrgIdsToDenyOnCw() {
  return getOrganizationIdsNotManagedBy(["CommonWell"]);
}
