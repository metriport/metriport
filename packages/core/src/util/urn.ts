const urnRegex = /^urn:oid:/;

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function wrapIdInUrnOid(id: string): string {
  return `urn:oid:${id}`;
}

export function stripUrnPrefix(urn: string | number): string {
  if (typeof urn === "number") {
    return urn.toString();
  }
  return urn.replace(urnRegex, "");
}
