import { normalizeCountrySafe, normalizedCountryUsa } from "../country";

describe("country", () => {
  describe("normalizeCountrySafe", () => {
    it("should return undefined when it gets empty string", () => {
      const input = "";
      expect(normalizeCountrySafe(input)).toBeUndefined();
    });

    it("should return undefined when it gets space", () => {
      const input = " ";
      expect(normalizeCountrySafe(input)).toBeUndefined();
    });

    const countries = [
      normalizedCountryUsa,
      "US",
      "U.S",
      "U.S.",
      "U.S.A",
      "UNITED STATES",
      "UNITED STATES OF AMERICA",
    ];
    for (const country of countries) {
      it(`valid - ${country}`, () => {
        const result = normalizeCountrySafe(country);
        expect(result).toBe(normalizedCountryUsa);
      });
    }
    for (const country of countries.map(c => c.toLowerCase())) {
      it(`valid - ${country}`, () => {
        const result = normalizeCountrySafe(country);
        expect(result).toBe(normalizedCountryUsa);
      });
    }

    it("should trim input prefix", () => {
      const expectedOutput = normalizedCountryUsa;
      const input = " " + expectedOutput;
      expect(normalizeCountrySafe(input)).toBe(expectedOutput);
    });

    it("should trim input suffix", () => {
      const expectedOutput = normalizedCountryUsa;
      const input = expectedOutput + " ";
      expect(normalizeCountrySafe(input)).toBe(expectedOutput);
    });

    it("should return undefined when it gets invalid country", () => {
      const input = "germany";
      expect(normalizeCountrySafe(input)).toBeUndefined();
    });
  });
});
