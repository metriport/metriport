const urnRegex = /^urn:(oid|uuid):/;
const bracketRegex = /(^\[|\]$)/g;

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function wrapIdInUrnUuidIfMissing(id: string): string {
  if (id.startsWith("urn:uuid:")) {
    return id;
  }
  return wrapIdInUrnUuid(id);
}

export function wrapIdInUrnId(id: string): string {
  return `urn:id:${id}`;
}

export function wrapIdInUrnOid(id: string): string {
  return `urn:oid:${id}`;
}

export function wrapOidInUrnOidIfMissing(id: string): string {
  if (id.startsWith("urn:oid:")) {
    return id;
  }
  return wrapIdInUrnOid(id);
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

export function stripBrackets(urn: string | number | undefined): string {
  if (urn === undefined) {
    return "";
  }
  if (typeof urn === "number") {
    return urn.toString();
  }
  return urn.replace(bracketRegex, "");
}
