import { chunk, cloneDeep } from "lodash";
import orgs from "../cq-org-list.json";
import { getOrgChunksFromPos, getOrgsByPrio } from "../get-orgs";

const orgsForTest = cloneDeep(orgs);

const defaultChunkSize = 50;

describe("getOrgs", () => {
  describe("getOrgsByPrio", () => {
    it("gets orgs in groups by prio", () => {
      const result = getOrgsByPrio();
      expect(result).toBeTruthy();
      expect(result.high.length).toBeTruthy();
      expect(result.medium.length).toBeTruthy();
      expect(result.low.length).toBeTruthy();
    });
  });

  describe("getOrgChunksFromPos", () => {
    it("returns total of orgs", () => {
      const { total } = getOrgChunksFromPos();
      expect(total).toBeTruthy();
      expect(total).toEqual(orgsForTest.length);
    });

    it("returns chunks with 10 elements", () => {
      const { chunks } = getOrgChunksFromPos({ chunkSize: 10 });
      expect(chunks).toBeTruthy();
      expect(chunks.length).toEqual(Math.ceil(orgsForTest.length / 10));
    });

    it("returns all chunks when no fromPos is set", () => {
      const { chunks } = getOrgChunksFromPos();
      expect(chunks).toBeTruthy();
      expect(chunks.length).toEqual(chunk(orgsForTest, defaultChunkSize).length);
    });

    it("returns from 11th chunk when fromPos is 10", () => {
      const expectedArray = chunk(orgsForTest, defaultChunkSize);
      expectedArray.splice(0, 10);
      const { total, chunks } = getOrgChunksFromPos({ fromPos: 10 });
      expect(total).toEqual(orgsForTest.length);
      expect(chunks).toBeTruthy();
      expect(chunks.length).toEqual(expectedArray.length);
      expect(chunks).toEqual(expect.arrayContaining(expectedArray));
    });
  });
});
