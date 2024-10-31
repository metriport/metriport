import { faker } from "@faker-js/faker";
import { normalizeZipCodeSafe } from "../zip";

function getFiveDigitZip() {
  return faker.number.int({ min: 10000, max: 99999 }).toString();
}

describe("zip", () => {
  describe("normalizeZipCodeSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    it("should handle 5 digits", () => {
      const input = getFiveDigitZip();
      const expectedOutput = input;
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should slice to 5 digits", () => {
      const expectedOutput = getFiveDigitZip();
      const input = expectedOutput + "1";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = " " + expectedOutput;
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = expectedOutput + " ";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for zip codes that are too short", () => {
      const input = "12";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    it("should return undefined for zip codes that have too many dashes", () => {
      const input = "12345-66-77";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    it("should handle short zip codes (v1)", () => {
      const input = "123";
      const expectedOutput = "00123";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should handle short zip codes (v2)", () => {
      const input = "1234";
      const expectedOutput = "01234";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should handle 5 digits when contains dash at index 5", () => {
      const input = "12345-6677";
      const expectedOutput = "12345";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should slice 5 digits when contains dash at index 5+", () => {
      const input = "123456-6677";
      const expectedOutput = "12345";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should handle short zip codes when contains dash at index 5-", () => {
      const input = "1234-6677";
      const expectedOutput = "01234";
      expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined if zip contains non-digit and non-dash characters (length 5)", () => {
      const input = "1234a";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    it("should return undefined if zip contains non-digit and non-dash characters (length 9)", () => {
      const input = "12345-667a";
      expect(normalizeZipCodeSafe(input)).toBeUndefined();
    });

    describe("examples from the wild", () => {
      const tests = [{ input: "2468", expectedOutput: "02468" }];
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeZipCodeSafe(input)).toBe(expectedOutput);
        });
      }
    });
  });
});
