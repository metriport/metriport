import { CQDirectoryEntryModel } from "../../models/cq-directory";
import { CQOrgBasicDetails, toBasicOrgAttributes } from "./search-cq-directory";
import { getOrgs } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";

const cqOrgsHydrated = getOrgs();

export function sortCQOrganizationsByPrio(cqOrgs: CQDirectoryEntryModel[]): CQOrgBasicDetails[] {
  const orgsWithPrio = mapCQOrganizationPriorities(cqOrgs);
  const sortedOrgs = sortByPrio(orgsWithPrio);
  const sortedOrgBasics = sortedOrgs.map(toBasicOrgAttributes);
  return sortedOrgBasics;
}

type CQOrganizationWithPrio = CQDirectoryEntryModel & { prio: string | undefined };

function mapCQOrganizationPriorities(cqOrgs: CQDirectoryEntryModel[]): CQOrganizationWithPrio[] {
  const res = cqOrgs.map(org => {
    const matchingOrg = cqOrgsHydrated.find(o => o.id === org.id);
    return {
      ...org.dataValues,
      prio: matchingOrg ? matchingOrg.prio : undefined,
    } as CQOrganizationWithPrio;
  });
  return res;
}

function sortByPrio(orgs: CQOrganizationWithPrio[]): CQOrganizationWithPrio[] {
  const high = orgs.filter(o => o.prio === "high");
  const medium = orgs.filter(o => o.prio === "medium");
  const low = orgs.filter(o => o.prio === "low" || !o.prio);
  return [...high, ...medium, ...low];
}
