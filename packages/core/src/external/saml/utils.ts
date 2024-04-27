import dayjs from "dayjs";

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function wrapIdInUrnOid(id: string): string {
  return `urn:oid:${id}`;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}
