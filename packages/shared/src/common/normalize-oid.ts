const OID_REGEX = /^(urn:oid:)?([0-9]+(\.[0-9]+)*)$/;

export function normalizeOid(oid: string): string {
  const match = OID_REGEX.exec(oid);
  if (match && match[2]) {
    return match[2];
  }

  throw new Error("OID is not valid");
}
