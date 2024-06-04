const urnRegex = /^urn:oid:/;

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function wrapIdInUrnOid(id: string): string {
  return `urn:oid:${id}`;
}

export function stripUrnPrefix(urn: string | number | undefined): string {
  if (urn === undefined) {
    return "";
  }
  if (typeof urn === "number") {
    return urn.toString();
  }
  return urn.replace(urnRegex, "");
}
