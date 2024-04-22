import dayjs from "dayjs";

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}
