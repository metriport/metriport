import BadRequestError from "@metriport/core/util/error/bad-request";

export function normalizeOid(oid: string | undefined): string {
  if (!oid) throw new BadRequestError("OID must be present");
  const oidRegex = /^[0-9]+(\.[0-9]+)*$/;
  const urnOidRegex = /^urn:oid:([0-9]+(\.[0-9]+)*)$/;

  if (oidRegex.test(oid)) {
    return oid;
  }

  const match = urnOidRegex.exec(oid);
  if (match && match[1]) {
    return match[1];
  }

  throw new BadRequestError(
    "Check the OID to make sure it conforms to the proper format: `1.22.333.444`"
  );
}
