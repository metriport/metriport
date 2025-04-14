import { isValid, getMatches } from "../index";
import { ValidationMatch } from "../interfaces";

describe("driver-license-validator", () => {
  describe("isValid", () => {
    it("should return true for valid driver license numbers", () => {
      expect(isValid("A1234567")).toBe(true);
      expect(isValid("123456789")).toBe(true);
      expect(isValid("AB12345")).toBe(true);
      expect(isValid("1234567")).toBe(true);
    });

    it("should return false for invalid driver license numbers", () => {
      expect(isValid("")).toBe(false);
      expect(isValid("invalid_dl")).toBe(false);
      expect(isValid("AB@123")).toBe(false); // Invalid characters
      expect(isValid("ABCDEFGHIJKLM")).toBe(false); // Invalid format
    });

    it("should filter by country", () => {
      expect(isValid("A1234567", { country: "CA" })).toBe(false);
      expect(isValid("A123456789", { country: "CA" })).toBe(true);
    });

    it("should filter by state", () => {
      expect(isValid("A1234567", { states: "CA" })).toBe(true);
      expect(isValid("A1234567", { states: "TX" })).toBe(false);
      expect(isValid("A1234567", { states: ["CA", "NY"] })).toBe(true);
    });

    it("should respect ignoreCase option", () => {
      expect(isValid("a1234567")).toBe(false);
      expect(isValid("a1234567", { ignoreCase: true })).toBe(true);
    });

    // Massachusetts driver's license formats
    it("should validate Massachusetts driver's license formats", () => {
      // Test the "SA + 7 numbers" format (2 letters followed by 7 numbers)
      expect(isValid("SA1234567", { states: "MA" })).toBe(true);
      expect(isValid("S12345678", { states: "MA" })).toBe(true);
      expect(isValid("123456789", { states: "MA" })).toBe(true);
      expect(isValid("S123456", { states: "MA" })).toBe(false); // Invalid format for MA
    });
  });

  describe("getMatches", () => {
    it("should return matching formats for valid driver license numbers", () => {
      const matches = getMatches("A1234567");
      expect(matches).not.toBeNull();
      
      if (matches) {
        expect(Array.isArray(matches)).toBe(true);
        expect(matches.length).toBeGreaterThan(0);
        
        const caMatch = matches.find(m => m.state === "CA");
        expect(caMatch).toBeDefined();
        if (caMatch) {
          expect(caMatch.description).toBe("1 letter followed by 7 numbers");
        }
      }
    });

    it("should return null for invalid driver license numbers", () => {
      expect(getMatches("invalid_dl")).toBeNull();
    });

    it("should filter matches by country", () => {
      const matches = getMatches("A123456789", { country: "CA" });
      expect(matches).not.toBeNull();
      
      if (matches) {
        matches.forEach(match => {
          expect(["AB", "BC", "MB", "NB", "NL", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT"]).toContain(match.state);
        });
      }
    });

    it("should filter matches by state", () => {
      const matches = getMatches("A1234567", { states: "CA" });
      expect(matches).not.toBeNull();
      
      if (matches) {
        expect(matches.length).toBe(1);
        
        const firstMatch = matches[0] as ValidationMatch;
        expect(firstMatch.state).toBe("CA");
      }
      
      const multiMatches = getMatches("A1234567", { states: ["CA", "NY"] });
      expect(multiMatches).not.toBeNull();
      
      if (multiMatches) {
        expect(multiMatches.length).toBe(2);
        
        const stateList = multiMatches.map(m => m.state).sort();
        expect(stateList).toEqual(["CA", "NY"]);
      }
    });

    it("should throw an error for invalid state", () => {
      expect(() => getMatches("A1234567", { states: "XX" })).toThrow();
    });
  });
});
