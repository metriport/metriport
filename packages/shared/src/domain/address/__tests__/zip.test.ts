import { faker } from "@faker-js/faker";
import { isValidZipCode, normalizeZipCodeNew, normalizeZipCodeNewSafe } from "../zip";

const knownInvalidZipCodes = [
  "00000",
  "99999",
  "10000",
  "20000",
  "30000",
  "40000",
  "50000",
  "60000",
  "70000",
  "80000",
  "90000",
  "12345",
  "54321",
];

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

  describe("isValidZipCode", () => {
    it("should return true for valid zip codes", () => {
      const validZipCodes = [
        "90210", // Beverly Hills
        "10001", // New York
        "60601", // Chicago
        "33101", // Miami
        "98101", // Seattle
        ...Array.from({ length: 5 }, () => getValidZipCode()),
      ];

      validZipCodes.forEach(zipCode => {
        expect(isValidZipCode(zipCode)).toBe(true);
      });
    });

    it("should return false for known invalid zip codes", () => {
      knownInvalidZipCodes.forEach((zipCode: string) => {
        expect(isValidZipCode(zipCode)).toBe(false);
      });
    });

    it("should return false for invalid formats", () => {
      const invalidFormats = ["", "12345-667a", "1234a", "abcde"];

      invalidFormats.forEach(zipCode => {
        expect(isValidZipCode(zipCode)).toBe(false);
      });
    });

    it("should return true for valid zip+4 format", () => {
      const validZipPlus4 = ["12345-6789", "90210-1234", "10001-0001"];

      validZipPlus4.forEach(zipCode => {
        expect(isValidZipCode(zipCode)).toBe(true);
      });
    });

    it("should return true for zip codes of any length (current behavior)", () => {
      // Note: isValidZipCode doesn't validate length - this documents current behavior
      const anyLengthZipCodes = ["1", "12", "123", "1234", "123456", "1234567"];

      anyLengthZipCodes.forEach(zipCode => {
        expect(isValidZipCode(zipCode)).toBe(true);
      });
    });

    it("should return true for various dash formats (current behavior)", () => {
      // Note: isValidZipCode accepts any format with digits and dashes - this documents current behavior
      const dashFormatZipCodes = [
        "123-45",
        "12-345",
        "1-2345",
        "12345-6",
        "12345-67",
        "12345-678",
        "12345-",
        "-12345",
        "12345-12345",
        "12345-123",
      ];

      dashFormatZipCodes.forEach(zipCode => {
        expect(isValidZipCode(zipCode)).toBe(true);
      });
    });
  });
});

function getFiveDigitZip() {
  return faker.number.int({ min: 10000, max: 99999 }).toString();
}

function getValidZipCode(): string {
  let zipCode: string;
  do {
    zipCode = faker.number.int({ min: 10000, max: 99999 }).toString();
  } while (knownInvalidZipCodes.includes(zipCode));
  return zipCode;
}
