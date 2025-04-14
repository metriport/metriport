import { LOINC_URL, SNOMED_URL } from "../../../../util/constants";
import { normalizeCoding } from "../coding";

const testDisplay = "Test Display";

describe("SNOMED code regex validation", () => {
  const testCases = [
    // Valid SNOMED codes
    {
      code: "123456",
      expected: { system: SNOMED_URL, code: "123456", display: testDisplay },
      desc: "6 digits",
    },
    {
      code: "123456789",
      expected: { system: SNOMED_URL, code: "123456789", display: testDisplay },
      desc: "9 digits",
    },
    {
      code: "123456789012345678",
      expected: { system: SNOMED_URL, code: "123456789012345678", display: testDisplay },
      desc: "18 digits",
    },

    // Invalid SNOMED codes that match LOINC format
    {
      code: "12345-6",
      expected: { system: LOINC_URL, code: "12345-6", display: testDisplay },
      desc: "matches LOINC format",
    },
    {
      code: "LA123-4",
      expected: { system: LOINC_URL, code: "LA123-4", display: testDisplay },
      desc: "matches LOINC format with letters",
    },

    // Invalid SNOMED codes
    {
      code: "",
      expected: { system: SNOMED_URL, display: testDisplay },
      desc: "empty code string",
    },
    {
      code: "12345",
      expected: { display: testDisplay },
      desc: "too short (5 digits)",
    },
    {
      code: "1234567890123456789",
      expected: { display: testDisplay },
      desc: "too long (19 digits)",
    },
    {
      code: "12345a",
      expected: { display: testDisplay },
      desc: "contains letters",
    },
    {
      code: "123-456",
      expected: { display: testDisplay },
      desc: "contains hyphen",
    },
    {
      code: "123 456",
      expected: { display: testDisplay },
      desc: "contains space",
    },
    {
      code: "12.345",
      expected: { display: testDisplay },
      desc: "contains decimal",
    },
  ];

  // Test empty string separately since it has different behavior
  it("should return coding without code for empty string code", () => {
    const coding = {
      system: SNOMED_URL,
      code: "",
      display: testDisplay,
    };
    expect(normalizeCoding(coding)).toEqual({ system: SNOMED_URL, display: testDisplay });
  });

  testCases.forEach(({ code, expected, desc }) => {
    it(`should handle SNOMED code: ${desc}`, () => {
      const coding = {
        system: SNOMED_URL,
        code,
        display: testDisplay,
      };
      expect(normalizeCoding(coding)).toEqual(expected);
    });
  });
});

describe("LOINC code regex validation", () => {
  const testCases = [
    // Valid LOINC codes
    {
      code: "12345-6",
      expected: { system: LOINC_URL, code: "12345-6", display: testDisplay },
      desc: "standard format (5+1)",
    },
    {
      code: "1234-5",
      expected: { system: LOINC_URL, code: "1234-5", display: testDisplay },
      desc: "4+1 digits",
    },
    {
      code: "123-4",
      expected: { system: LOINC_URL, code: "123-4", display: testDisplay },
      desc: "3+1 digits",
    },
    {
      code: "LA123-4",
      expected: { system: LOINC_URL, code: "LA123-4", display: testDisplay },
      desc: "contains letters",
    },
    {
      code: "12345678-9",
      expected: { system: LOINC_URL, code: "12345678-9", display: testDisplay },
      desc: "8+1 digits",
    },

    // Invalid LOINC codes
    {
      code: "",
      expected: { system: LOINC_URL, display: testDisplay },
      desc: "empty code string",
    },
    {
      code: "12-3",
      expected: { display: testDisplay },
      desc: "too short before hyphen",
    },
    {
      code: "123456789-0",
      expected: { display: testDisplay },
      desc: "too long before hyphen",
    },
    {
      code: "12345-67",
      expected: { display: testDisplay },
      desc: "multiple digits after hyphen",
    },
    {
      code: "12345",
      expected: { display: testDisplay },
      desc: "missing hyphen",
    },
    {
      code: "-1",
      expected: { display: testDisplay },
      desc: "starts with hyphen",
    },
    {
      code: "12345-",
      expected: { display: testDisplay },
      desc: "ends with hyphen",
    },
    {
      code: "123 45-6",
      expected: { display: testDisplay },
      desc: "contains space",
    },
    {
      code: "!@#45-6",
      expected: { display: testDisplay },
      desc: "special characters",
    },
    {
      code: "12.345-6",
      expected: { display: testDisplay },
      desc: "contains decimal",
    },
  ];

  // Test empty string separately since it has different behavior
  it("should return coding without code for empty string code", () => {
    const coding = {
      system: LOINC_URL,
      code: "",
      display: testDisplay,
    };
    expect(normalizeCoding(coding)).toEqual({ system: LOINC_URL, display: testDisplay });
  });

  testCases.forEach(({ code, expected, desc }) => {
    it(`should handle LOINC code: ${desc}`, () => {
      const coding = {
        system: LOINC_URL,
        code,
        display: testDisplay,
      };
      expect(normalizeCoding(coding)).toEqual(expected);
    });
  });
});

describe("SNOMED to LOINC conversion", () => {
  const testCases = [
    {
      code: "12345-6",
      desc: "valid LOINC format in SNOMED should convert to LOINC",
      expectedSystem: LOINC_URL,
      expectedCode: "12345-6",
    },
    {
      code: "LA123-4",
      desc: "valid LOINC format with letters in SNOMED should convert to LOINC",
      expectedSystem: LOINC_URL,
      expectedCode: "LA123-4",
    },
    {
      code: "123456",
      desc: "valid SNOMED should stay as SNOMED",
      expectedSystem: SNOMED_URL,
      expectedCode: "123456",
    },
    {
      code: "invalid-code",
      desc: "invalid format for both should return just display",
      expectedDisplayOnly: true,
    },
  ];

  testCases.forEach(({ code, desc, expectedSystem, expectedCode, expectedDisplayOnly }) => {
    it(desc, () => {
      const coding = {
        system: SNOMED_URL,
        code,
        display: testDisplay,
      };
      const normalized = normalizeCoding(coding);
      if (expectedDisplayOnly) {
        expect(normalized).toEqual({ display: testDisplay });
      } else {
        expect(normalized.system).toBe(expectedSystem);
        expect(normalized.code).toBe(expectedCode);
        expect(normalized.display).toBe(testDisplay);
      }
    });
  });
});
