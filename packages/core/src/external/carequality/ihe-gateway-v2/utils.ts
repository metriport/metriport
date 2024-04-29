import dayjs from "dayjs";
import { genderMapping } from "../../fhir/patient";

const urnRegex = /^urn:oid:/;

export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderMapping[gender] ?? undefined;
}

export function stripUrnPrefix(urn: string | number): string {
  if (typeof urn === "number") {
    return urn.toString();
  }
  return urn.replace(urnRegex, "");
}

export function constructFileName({
  cxId,
  patientId,
  metriportId,
  extension,
}: {
  cxId: string;
  patientId: string;
  metriportId: string;
  extension: string;
}): string {
  return `${cxId}_${patientId}_${metriportId}${extension}`;
}

export function constructFilePath({
  cxId,
  patientId,
  fileName,
}: {
  cxId: string;
  patientId: string;
  fileName: string;
}): string {
  return `${cxId}/${patientId}/${fileName}`;
}

export function wrapIdInUrnUuid(id: string): string {
  return `urn:uuid:${id}`;
}

export function timestampToSoapBody(createdTimestamp: string): string {
  return dayjs(createdTimestamp).toISOString();
}
