import { faker } from "@faker-js/faker";
import { normalizeZipCodeOrThrow, normalizeZipCode } from "../zip";

function getFiveDigitZip() {
  return faker.number.int({ min: 10000, max: 99999 }).toString();
}

describe("zip", () => {
  describe("normalizeZipCodeOrThrow", () => {
    it("returns the result of the normalizeFn param", () => {
      const expectedOutput = getFiveDigitZip();
      const normalizeFn = jest.fn(() => expectedOutput);
      expect(normalizeZipCodeOrThrow("54321", normalizeFn)).toBe(expectedOutput);
    });

    it("should throw an error if zip is an empty string", () => {
      const normalizeFn = jest.fn(() => undefined);
      expect(() => normalizeZipCodeOrThrow("54321", normalizeFn)).toThrow();
    });
  });

  describe("safe normalizeZipCode", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      const expectedOutput = undefined;
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      const expectedOutput = undefined;
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should handle 5 digits", () => {
      const input = getFiveDigitZip();
      const expectedOutput = input;
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should trim input prefix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = " " + expectedOutput;
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = getFiveDigitZip();
      const input = expectedOutput + " ";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should return undefined for zip codes that are too short", () => {
      const input = "12";
      expect(normalizeZipCode(input)).toBeUndefined();
    });

    it("should handle short zip codes", () => {
      const input = "123";
      const expectedOutput = "00123";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should return padded ZIP+4 format when contains dash at position 4", () => {
      const input = "1234-6677";
      const expectedOutput = "01234-6677";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should return full ZIP+4 format when zip code length is 10", () => {
      const input = "12345-6677";
      const expectedOutput = "12345-6677";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    describe("invalid input handling", () => {
      const invalidInputTests = [
        { input: "12345-667a", description: "non-digit characters in ZIP+4 format" },
        { input: "1234a", description: "non-digit characters in 5-digit format" },
        { input: "12-34567", description: "invalid dash placement" },
        { input: "12345-12345", description: "too long plus4 part" },
      ];

      for (const { input, description } of invalidInputTests) {
        it(`should return undefined for ${description}`, () => {
          expect(normalizeZipCode(input)).toBeUndefined();
        });
      }
    });

    it("should handle 9-digit ZIP codes without hyphen by adding hyphen", () => {
      const input = "123456677";
      const expectedOutput = "12345-6677";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should handle partial ZIP+4 with 3 digits before dash and full plus4", () => {
      const input = "123-1234";
      const expectedOutput = "00123-1234";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    it("should handle ZIP+4 with empty plus4 part", () => {
      const input = "12345-";
      const expectedOutput = "12345";
      expect(normalizeZipCode(input)).toBe(expectedOutput);
    });

    describe("full ZIP+4 format handling", () => {
      const fullPlus4Tests = [
        {
          input: "1234-6677",
          expectedOutput: "01234-6677",
          description: "short ZIP with full plus4",
        },
        {
          input: "12345-6677",
          expectedOutput: "12345-6677",
          description: "standard ZIP with full plus4",
        },
        {
          input: "123-1234",
          expectedOutput: "00123-1234",
          description: "very short ZIP with full plus4",
        },
      ];

      for (const { input, expectedOutput, description } of fullPlus4Tests) {
        it(`should preserve full ZIP+4 format for ${description}`, () => {
          expect(normalizeZipCode(input)).toBe(expectedOutput);
        });
      }
    });

    describe("partial ZIP+4 format handling", () => {
      const partialPlus4Tests = [
        {
          input: "12345-1",
          expectedOutput: "12345",
          description: "standard ZIP with 1-digit plus4",
        },
        {
          input: "12345-12",
          expectedOutput: "12345",
          description: "standard ZIP with 2-digit plus4",
        },
        {
          input: "12345-123",
          expectedOutput: "12345",
          description: "standard ZIP with 3-digit plus4",
        },
        { input: "1234-1", expectedOutput: "01234", description: "short ZIP with 1-digit plus4" },
        { input: "1234-12", expectedOutput: "01234", description: "short ZIP with 2-digit plus4" },
        { input: "1234-123", expectedOutput: "01234", description: "short ZIP with 3-digit plus4" },
      ];

      for (const { input, expectedOutput, description } of partialPlus4Tests) {
        it(`should return main ZIP only for ${description}`, () => {
          expect(normalizeZipCode(input)).toBe(expectedOutput);
        });
      }
    });

    describe("length handling", () => {
      const lengthTests = [
        { input: "1234567890", expectedOutput: "12345", description: "very long ZIP codes" },
        { input: "123456", expectedOutput: "12345", description: "6-digit ZIP codes" },
      ];

      for (const { input, expectedOutput, description } of lengthTests) {
        it(`should truncate ${description} to first 5 digits`, () => {
          expect(normalizeZipCode(input)).toBe(expectedOutput);
        });
      }
    });

    describe("examples from the wild", () => {
      const tests = [{ input: "2468", expectedOutput: "02468" }];
      for (const { input, expectedOutput } of tests) {
        it(`should return ${expectedOutput} when input is ${input}`, () => {
          expect(normalizeZipCode(input)).toBe(expectedOutput);
        });
      }
    });
  });
});
