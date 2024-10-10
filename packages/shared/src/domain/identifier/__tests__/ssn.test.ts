import { faker } from "@faker-js/faker";
import { normalizeSsnSafe } from "../ssn";

function getNineDigitSsn() {
  return faker.number.int({ min: 100000000, max: 999999999 }).toString();
}

describe("ssn", () => {
  describe("normalizeSsnSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });

    it("should handle 9 digits", () => {
      const input = getNineDigitSsn();
      const expectedOutput = input;
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should slice to 9 digits", () => {
      const expectedOutput = getNineDigitSsn();
      const input = expectedOutput + "1";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = getNineDigitSsn();
      const input = " " + expectedOutput;
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = getNineDigitSsn();
      const input = expectedOutput + " ";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for ssns that are too short", () => {
      const input = "12345678";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });

    it("should return undefined for ssns that have too many dashes", () => {
      const input = "123-45-678-9";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });

    it("should handle 9 digits with dashes (v1)", () => {
      const input = "123-45-6789";
      const expectedOutput = "123456789";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should handle 9 digits with dashes (v2)", () => {
      const input = "12-345-6789";
      const expectedOutput = "123456789";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should handle 9 digits with dashes (v3)", () => {
      const input = "123-4567890";
      const expectedOutput = "123456789";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should slice to 9 digits with dashes", () => {
      const input = "123-45-67891";
      const expectedOutput = "123456789";
      expect(normalizeSsnSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined if ssn contains non-digit and non-dash characters (length 11)", () => {
      const input = "123-45-6789a";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });

    it("should return undefined if ssn contains non-digit and non-dash characters (length 9)", () => {
      const input = "123456789a";
      expect(normalizeSsnSafe(input)).toBeUndefined();
    });
  });
});
