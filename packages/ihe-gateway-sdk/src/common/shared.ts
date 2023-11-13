const OID_REGEX = /^(urn:oid:)?([0-9]+(\.[0-9]+)*)$/;

export function normalizeOid(oid: string | undefined): string {
  if (!oid) throw new Error("OID must be present");

  const match = OID_REGEX.exec(oid);
  if (match && match[2]) {
    return match[2];
  }

  throw new Error("Check the OID to make sure it conforms to the proper format: `1.22.333.444`");
}
