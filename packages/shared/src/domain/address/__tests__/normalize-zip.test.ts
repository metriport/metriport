import { faker } from "@faker-js/faker";
import { normalizeZipCodeNew, normalizeZipCodeNewSafe } from "../zip";

function getFiveDigitZip() {
  return faker.number.int({ min: 10000, max: 99999 }).toString();
}

describe("zip", () => {
  describe("normalizeZipCodeNew", () => {
    it("returns the result of the normalizeFn param", () => {
      const expectedOutput = getFiveDigitZip();
      const normalizeFn = jest.fn(() => expectedOutput);
      expect(normalizeZipCodeNew("54321", normalizeFn)).toBe(expectedOutput);
    });

    it("should throw an error if zip is an empty string", () => {
      const normalizeFn = jest.fn(() => undefined);
      expect(() => normalizeZipCodeNew("54321", normalizeFn)).toThrow();
    });
  });

  describe("safe normalizeZipCodeNewSafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      const expectedOutput = undefined;
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      const expectedOutput = undefined;
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should handle 5 digits", () => {
      const input = getFiveDigitZip();
      const expectedOutput = input;
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = " " + expectedOutput;
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = expectedOutput + " ";
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined for zip codes that are too short", () => {
      const input = "12";
      expect(normalizeZipCodeNewSafe(input)).toBeUndefined();
    });

    it("should handle short zip codes", () => {
      const input = "123";
      const expectedOutput = "00123";
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should return padded first 4 characters when contains dash at position 4", () => {
      const input = "1234-6677";
      const expectedOutput = "01234";
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should return first 5 characters when zip code length is 10", () => {
      const input = "12345-6677";
      const expectedOutput = "12345";
      expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
    });

    it("should return undefined if zip contains non-digit and non-dash characters (length 9)", () => {
      const input = "12345-667a";
      expect(normalizeZipCodeNewSafe(input)).toBeUndefined();
    });

    it("should return undefined if zip contains non-digit and non-dash characters (length 5)", () => {
      const input = "1234a";
      expect(normalizeZipCodeNewSafe(input)).toBeUndefined();
    });

    describe("examples from the wild", () => {
      const tests = [{ input: "2468", expectedOutput: "02468" }];
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeZipCodeNewSafe(input)).toBe(expectedOutput);
        });
      }
    });
  });
});
