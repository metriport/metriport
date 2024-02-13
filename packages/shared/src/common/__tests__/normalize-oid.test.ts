import { normalizeOid } from "../normalize-oid";

const shorterValidOid = "1";
const shorterInvalidOid = "1000";
const validOid = "1.22.333.444";
const longerValidOid = "1.22.33.444.555.6677.889999.0001";
const validOidWithPrefix = "urn:oid:1.22.333.444";
const invalidOid = "notAnOid";
const consecutiveDotsInvalidOid = "1.22.333..444";
const validOidWithTrailingString = "1.22.333.444SomeJunk";
const oidWithLeadingAndTrailingJunk = "SomeJunk1.22.333.444SomeJunk";
const oidWithLeadingZeros = "1.02.003.0004";
const emptyString = "";
const onlyDots = "...";
const leadingDots = ".1.22.333.444";
const multipleLeadingDots = "..1.22.333.444";
const rootBoundaryZero = "0.1.2";
const rootBoundaryTwo = "2.999.999";
const nonNumericInOid = "1.22.33a.444";
const oidWithSpaces = "1. 22.333 .444";
const oidWithCommas = "1,22,333,444";

describe("normalizeOid", () => {
  it("should return the same oid if it is already valid", () => {
    expect(normalizeOid(validOid)).toBe(validOid);
    expect(normalizeOid(shorterValidOid)).toBe(shorterValidOid);
    expect(normalizeOid(longerValidOid)).toBe(longerValidOid);
  });

  it("should return the oid without the junk surrounding it", () => {
    expect(normalizeOid(validOidWithPrefix)).toBe(validOid);
    expect(normalizeOid(validOidWithTrailingString)).toBe(validOid);
  });

  it("should throw an error if oid does not conform to the format", () => {
    expect(() => normalizeOid(invalidOid)).toThrow("OID is not valid");
    expect(() => normalizeOid(consecutiveDotsInvalidOid)).toThrow("OID is not valid");
    expect(() => normalizeOid(shorterInvalidOid)).toThrow("OID is not valid");
  });

  it("should return the oid without leading and trailing junk", () => {
    expect(normalizeOid(oidWithLeadingAndTrailingJunk)).toBe(validOid);
  });

  it("should correctly handle OIDs with leading zeros", () => {
    expect(normalizeOid(oidWithLeadingZeros)).toBe(oidWithLeadingZeros);
  });

  it("should throw an error for empty string or only dots", () => {
    expect(() => normalizeOid(emptyString)).toThrow("OID is not valid");
    expect(() => normalizeOid(onlyDots)).toThrow("OID is not valid");
  });

  it("should throw an error for leading dots", () => {
    expect(() => normalizeOid(leadingDots)).toThrow("OID is not valid");
    expect(() => normalizeOid(multipleLeadingDots)).toThrow("OID is not valid");
  });

  it("should handle root code boundary conditions", () => {
    expect(normalizeOid(rootBoundaryZero)).toBe(rootBoundaryZero);
    expect(normalizeOid(rootBoundaryTwo)).toBe(rootBoundaryTwo);
  });

  it("should throw an error for non-numeric characters in OID parts", () => {
    expect(() => normalizeOid(nonNumericInOid)).toThrow("OID is not valid");
  });

  it("should throw an error for OIDs with spaces or other delimiters", () => {
    expect(() => normalizeOid(oidWithSpaces)).toThrow("OID is not valid");
    expect(() => normalizeOid(oidWithCommas)).toThrow("OID is not valid");
  });
});
