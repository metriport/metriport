import { normalizeOid } from "../shared";
const validOid = "1.22.333.444";
const validOidWithPrefix = "urn:oid:1.22.333.444";
const invalidOid = "notAnOid";

describe("normalizeOid", () => {
  it("should throw BadRequestError if oid is undefined", () => {
    expect(() => normalizeOid(undefined)).toThrow(Error);
    expect(() => normalizeOid(undefined)).toThrow("OID must be present");
  });

  it("should return the same oid if it is already valid", () => {
    expect(normalizeOid(validOid)).toBe(validOid);
  });

  it("should return the oid without the urn:oid: prefix", () => {
    expect(normalizeOid(validOidWithPrefix)).toBe(validOid);
  });

  it("should throw BadRequestError if oid does not conform to the format", () => {
    expect(() => normalizeOid(invalidOid)).toThrow(Error);
    expect(() => normalizeOid(invalidOid)).toThrow(
      "Check the OID to make sure it conforms to the proper format: `1.22.333.444`"
    );
  });
});
