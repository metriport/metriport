import { getOrganizationIds } from "../../../external/carequality/command/cq-directory/cq-gateways";

export async function getCqOrgIdsToDenyOnCw() {
  return getOrganizationIds(["CommonWell"]);
}
