import { chunk } from "lodash";
import orgs from "./cq-org-list.json";

const CQ_ORG_CHUNK_SIZE = 50;

export type SimpleOrg = {
  Id: string;
  Name: string;
  States: string[];
};

/**
 * Return CQ orgs.
 * @returns array of CQ orgs.
 */
export async function getOrgs(): Promise<SimpleOrg[]> {
  return orgs;
}

/**
 * Return CQ orgs in chunks.
 * @param chunkSize chunk size, defaults to 50.
 * @returns arrays of CQ orgs - each item/chunk is an array of CQ orgs.
 */
export async function getOrgsInChunks(
  chunkSize = CQ_ORG_CHUNK_SIZE
): Promise<{ total: number; chunks: SimpleOrg[][] }> {
  const orgs = await getOrgs();
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
export async function getOrgChunksFromPos({
  chunkSize,
  fromPos = 0,
}: {
  chunkSize?: number | undefined;
  fromPos?: number | undefined;
} = {}): Promise<{ total: number; chunks: SimpleOrg[][] }> {
  const { total, chunks } = await getOrgsInChunks(chunkSize);
  chunks.splice(0, Math.max(0, fromPos));
  return { total, chunks };
}
