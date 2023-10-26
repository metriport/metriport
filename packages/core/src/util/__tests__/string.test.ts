/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { safeStringify } from "../string";

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
      const original = () => {};
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
});
