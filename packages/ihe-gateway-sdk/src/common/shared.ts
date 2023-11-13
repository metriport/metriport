import BadRequestError from "@metriport/core/util/error/bad-request";
import NotFoundError from "@metriport/core/util/error/not-found";

const oidRegex = /^(urn:oid:)?([0-9]+(\.[0-9]+)*)$/;

export function normalizeOid(oid: string | undefined): string {
  if (!oid) {
    throw new NotFoundError("OID must be present");
  }

  const match = oidRegex.exec(oid);
  if (match && match[2]) {
    return match[2];
  }

  throw new BadRequestError(
    "Check the OID to make sure it conforms to the proper format: `1.22.333.444`"
  );
}
