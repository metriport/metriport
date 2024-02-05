const OID_REGEX = /(?:[^.\d]*)(\d+(?:\.*\d+)+)(?:[^.\d]*)/;

export function normalizeOid(input: string): string {
  const match = input.match(OID_REGEX);
  if (match && match[1]) {
    return match[1];
  }

  throw new Error("OID is not valid");
}
