/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { safeStringify, chunkWithOverlap } from "../string";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("string", () => {
  describe("safeStringify", () => {
    it("returns undefined when gets undefined", async () => {
      const res = safeStringify(undefined);
      expect(res).toEqual(undefined);
    });

    it("returns null when gets null", async () => {
      const res = safeStringify(null);
      expect(res).toEqual(null);
    });

    it("returns string when gets string", async () => {
      const original = faker.lorem.word();
      const res = safeStringify(original);
      expect(res).toEqual(original);
    });

    it("returns string when gets number", async () => {
      const original = faker.number.int();
      const expected = original.toString();
      const res = safeStringify(original);
      expect(res).toEqual(expected);
    });

    it("returns string when gets boolean", async () => {
      const original = faker.datatype.boolean();
      const expected = original.toString();
      const res = safeStringify(original);
      expect(res).toEqual(expected);
    });

    it("returns string when gets bigint", async () => {
      const original = faker.number.bigInt();
      const expected = original.toString();
      const res = safeStringify(original);
      expect(res).toEqual(expected);
    });

    it("returns string when gets function", async () => {
      function original() {}
      const expected = original.toString();
      const res = safeStringify(original);
      expect(res).toEqual(expected);
    });

    it("returns string when gets object", async () => {
      const original = { a: 1, b: 2 };
      const expected = JSON.stringify(original);
      const res = safeStringify(original);
      expect(res).toEqual(expected);
    });
  });

  describe("chunkWithOverlap", () => {
    it("chunks string with overlap", () => {
      const result = chunkWithOverlap("abcdefghij", 4, 2);
      expect(result).toEqual(["abcd", "cdef", "efgh", "ghij", "ij"]);
    });

    it("handles string shorter than chunk size", () => {
      const result = chunkWithOverlap("abc", 10, 2);
      expect(result).toEqual(["abc"]);
    });

    it("handles string equal to chunk size with zero overlap", () => {
      const result = chunkWithOverlap("abcd", 4, 0);
      expect(result).toEqual(["abcd"]);
    });

    it("handles maximum overlap (chunkSize - 1)", () => {
      const result = chunkWithOverlap("abcdef", 3, 2);
      expect(result).toEqual(["abc", "bcd", "cde", "def", "ef", "f"]);
    });

    it("throws error when overlapSize is greater than chunkSize", () => {
      expect(() => chunkWithOverlap("test", 5, 6)).toThrow(
        "overlapSize must be less than chunkSize"
      );
    });

    it("handles large strings correctly", () => {
      const largeString = "a".repeat(1000);
      const result = chunkWithOverlap(largeString, 100, 10);
      expect(result.length).toBe(12);
      expect(result[0]?.length).toBe(100);
      expect(result[result.length - 1]?.length).toBe(10);
      expect(result.every(chunk => chunk.length > 0)).toBe(true);
    });
  });
});
