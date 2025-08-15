import { chunk, groupBy } from "lodash";
import orgs from "./cq-org-list.json";

const CQ_ORG_CHUNK_SIZE = 50;

export type OrgPrio = "high" | "medium" | "low";

export type CQOrg = {
  id: string;
  name: string;
};

export type CQOrgHydrated = CQOrg & {
  states: string[];
  gateway: string;
  prio?: OrgPrio | undefined;
};

export type Gateway = CQOrg & {
  Organizations: CQOrg[];
};

/**
 * Return CQ orgs.
 * @returns array of CQ orgs.
 */
export function getOrgs(): CQOrgHydrated[] {
  return orgs as CQOrgHydrated[];
}

/**
 * Return CQ orgs grouped by priority.
 */
export function getOrgsByPrio(): Record<OrgPrio, CQOrgHydrated[]> {
  const result: Record<OrgPrio, CQOrgHydrated[]> = { high: [], medium: [], low: [] };
  const validKeys = Object.keys(result);
  const groups = groupBy(getOrgs(), "prio");
  // necessary b/c groupBy returns keys as string
  for (const [key, value] of Object.entries(groups)) {
    if (validKeys.includes(key)) result[key as OrgPrio] = value;
    else result["low"] = value;
  }
  return result;
}

export const isHighPrio = (org: CQOrgHydrated): boolean => org.prio === "high";
export const isMediumPrio = (org: CQOrgHydrated): boolean => org.prio === "medium";
export const isLowPrio = (org: CQOrgHydrated): boolean => org.prio === "low" || !org.prio;

/**
 * Return CQ orgs in chunks.
 * @param chunkSize chunk size, defaults to 50.
 * @returns arrays of CQ orgs - each item/chunk is an array of CQ orgs.
 */
export function getOrgsInChunks(
  chunkSize = CQ_ORG_CHUNK_SIZE,
  orgs = getOrgs()
): {
  total: number;
  chunks: CQOrgHydrated[][];
} {
  const total = orgs.length;
  const chunks = chunk(orgs, chunkSize);
  return { total, chunks };
}

/**
 * Return CQ orgs in chunks starting from a given position.
 * @param chunkSize chunk size, defaults to 50.
 * @param fromPos The initial chunk of CQ orgs to return (defaults to 0)
 * @returns arrays of CQ orgs - each item/chunk is an array of CQ orgs.
 */
export function getOrgChunksFromPos({
  chunkSize,
  fromPos = 0,
  orgs,
}: {
  chunkSize?: number | undefined;
  fromPos?: number | undefined;
  orgs?: CQOrgHydrated[];
} = {}): { total: number; chunks: CQOrgHydrated[][] } {
  const { total, chunks } = getOrgsInChunks(chunkSize, orgs);
  chunks.splice(0, Math.max(0, fromPos));
  return { total, chunks };
}
