import BadRequestError from "@metriport/core/util/error/bad-request";

const oidRegex = /^(urn:oid:)?([0-9]+(\.[0-9]+)*)$/;

export function normalizeOid(oid: string | undefined): string {
  if (!oid) {
    throw new BadRequestError("OID must be present");
  }

  const match = oidRegex.exec(oid);
  if (match && match[2]) {
    return match[2]; // Extracts the OID part, whether it's plain or in a URN format
  }

  throw new BadRequestError(
    "Check the OID to make sure it conforms to the proper format: `1.22.333.444`"
  );
}
