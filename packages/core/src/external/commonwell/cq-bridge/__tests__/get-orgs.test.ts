import { chunk, cloneDeep } from "lodash";
import orgs from "../cq-org-list.json";
import { getOrgChunksFromPos } from "../get-orgs";

const orgsForTest = cloneDeep(orgs);

const defaultChunkSize = 50;

describe("getOrgChunksFromPos", () => {
  it("returns total of orgs", async () => {
    const { total } = await getOrgChunksFromPos();
    expect(total).toBeTruthy();
    expect(total).toEqual(orgsForTest.length);
  });

  it("returns chunks with 10 elements", async () => {
    const { chunks } = await getOrgChunksFromPos({ chunkSize: 10 });
    expect(chunks).toBeTruthy();
    expect(chunks.length).toEqual(Math.ceil(orgsForTest.length / 10));
  });

  it("returns all chunks when no fromPos is set", async () => {
    const { chunks } = await getOrgChunksFromPos();
    expect(chunks).toBeTruthy();
    expect(chunks.length).toEqual(chunk(orgsForTest, defaultChunkSize).length);
  });

  it("returns from 11th chunk when fromPos is 10", async () => {
    const expectedArray = chunk(orgsForTest, defaultChunkSize);
    expectedArray.splice(0, 10);
    const { total, chunks } = await getOrgChunksFromPos({ fromPos: 10 });
    expect(total).toEqual(orgsForTest.length);
    expect(chunks).toBeTruthy();
    expect(chunks.length).toEqual(expectedArray.length);
    expect(chunks).toEqual(expect.arrayContaining(expectedArray));
  });
});
