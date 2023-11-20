import { normalizeOid } from "../normalize-oid";

const shorterValidOid = "1";
const validOid = "1.22.333.444";
const longerValidOid = "1.22.33.444.555.6677.889999.0001";
const validOidWithPrefix = "urn:oid:1.22.333.444";
const invalidOid = "notAnOid";
const consecutiveDotsInvalidOid = "1.22.333..444";

describe("normalizeOid", () => {
  it("should return the same oid if it is already valid", () => {
    expect(normalizeOid(validOid)).toBe(validOid);
    expect(normalizeOid(shorterValidOid)).toBe(shorterValidOid);
    expect(normalizeOid(longerValidOid)).toBe(longerValidOid);
  });

  it("should return the oid without the urn:oid: prefix", () => {
    expect(normalizeOid(validOidWithPrefix)).toBe(validOid);
  });

  it("should throw an error if oid does not conform to the format", () => {
    expect(() => normalizeOid(invalidOid)).toThrow("OID is not valid");
    expect(() => normalizeOid(consecutiveDotsInvalidOid)).toThrow("OID is not valid");
  });
});
