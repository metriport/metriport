import { LOINC_URL, SNOMED_URL } from "../../../../util/constants";
import { normalizeCoding } from "../coding";
import { unknownCoding } from "../../coding";

describe("SNOMED code regex validation", () => {
  const testCases = [
    // Valid SNOMED codes
    { code: "123456", expected: true, desc: "6 digits" },
    { code: "123456789", expected: true, desc: "9 digits" },
    { code: "123456789012345678", expected: true, desc: "18 digits" },

    // Invalid SNOMED codes
    { code: "12345", expected: false, desc: "too short (5 digits)" },
    { code: "1234567890123456789", expected: false, desc: "too long (19 digits)" },
    { code: "12345a", expected: false, desc: "contains letters" },
    { code: "123-456", expected: false, desc: "contains hyphen" },
    { code: "123 456", expected: false, desc: "contains space" },
    { code: "12.345", expected: false, desc: "contains decimal" },
  ];

  // Test empty string separately since it has different behavior
  it("should return unchanged coding for empty string code", () => {
    const coding = {
      system: SNOMED_URL,
      code: "",
      display: "Test code",
    };
    expect(normalizeCoding(coding)).toEqual(coding);
  });

  testCases.forEach(({ code, expected, desc }) => {
    it(`should ${expected ? "accept" : "reject"} SNOMED code: ${desc}`, () => {
      const coding = {
        system: SNOMED_URL,
        code,
        display: "Test code",
      };
      const normalized = normalizeCoding(coding);
      if (expected) {
        expect(normalized.code).toBe(code);
        expect(normalized.system).toBe(SNOMED_URL);
        expect(normalized.display).toBe("Test code");
      } else {
        expect(normalized).toEqual({
          ...unknownCoding,
          display: "Test code",
        });
      }
    });
  });
});

describe("LOINC code regex validation", () => {
  const testCases = [
    // Valid LOINC codes
    { code: "12345-6", expected: true, desc: "standard format (5+1)" },
    { code: "1234-5", expected: true, desc: "4+1 digits" },
    { code: "123-4", expected: true, desc: "3+1 digits" },
    { code: "ABC12-3", expected: true, desc: "contains letters" },
    { code: "12345678-9", expected: true, desc: "8+1 digits" },

    // Invalid LOINC codes
    { code: "12-3", expected: false, desc: "too short before hyphen" },
    { code: "123456789-0", expected: false, desc: "too long before hyphen" },
    { code: "12345-67", expected: false, desc: "multiple digits after hyphen" },
    { code: "12345", expected: false, desc: "missing hyphen" },
    { code: "-1", expected: false, desc: "starts with hyphen" },
    { code: "12345-", expected: false, desc: "ends with hyphen" },
    { code: "123 45-6", expected: false, desc: "contains space" },
    { code: "!@#45-6", expected: false, desc: "special characters" },
    { code: "12.345-6", expected: false, desc: "contains decimal" },
  ];

  // Test empty string separately since it has different behavior
  it("should return unchanged coding for empty string code", () => {
    const coding = {
      system: LOINC_URL,
      code: "",
      display: "Test code",
    };
    expect(normalizeCoding(coding)).toEqual(coding);
  });

  testCases.forEach(({ code, expected, desc }) => {
    it(`should ${expected ? "accept" : "reject"} LOINC code: ${desc}`, () => {
      const coding = {
        system: LOINC_URL,
        code,
        display: "Test code",
      };
      const normalized = normalizeCoding(coding);
      if (expected) {
        expect(normalized.code).toBe(code);
        expect(normalized.system).toBe(LOINC_URL);
        expect(normalized.display).toBe("Test code");
      } else {
        expect(normalized).toEqual({
          ...unknownCoding,
          display: "Test code",
        });
      }
    });
  });
});

describe("SNOMED to LOINC conversion", () => {
  const testCases = [
    {
      code: "12345-6",
      desc: "valid LOINC format in SNOMED should convert",
      expectedSystem: LOINC_URL,
      expectedCode: "12345-6",
    },
    {
      code: "ABC12-3",
      desc: "valid LOINC format with letters in SNOMED should convert",
      expectedSystem: LOINC_URL,
      expectedCode: "ABC12-3",
    },
    {
      code: "123456",
      desc: "valid SNOMED should stay as SNOMED",
      expectedSystem: SNOMED_URL,
      expectedCode: "123456",
    },
    {
      code: "invalid-code",
      desc: "invalid format for both should convert to unknown coding",
      expectedUnknown: true,
    },
  ];

  testCases.forEach(({ code, desc, expectedSystem, expectedCode, expectedUnknown }) => {
    it(desc, () => {
      const coding = {
        system: SNOMED_URL,
        code,
        display: "Test code",
      };
      const normalized = normalizeCoding(coding);
      if (expectedUnknown) {
        expect(normalized).toEqual({
          ...unknownCoding,
          display: "Test code",
        });
      } else {
        expect(normalized.system).toBe(expectedSystem);
        expect(normalized.code).toBe(expectedCode);
        expect(normalized.display).toBe("Test code");
      }
    });
  });
});
