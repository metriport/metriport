import { genderMapping } from "../../fhir/patient";

export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderMapping[gender] || undefined;
}
export function isGatewayWithOid(
  gateway:
    | {
        homeCommunityId: string;
        url: string;
      }
    | {
        id: string;
        oid: string;
        url: string;
      }
): gateway is { id: string; oid: string; url: string } {
  return "oid" in gateway;
}

export function stripUrnPrefix(urn: string): string {
  return urn.replace("urn:oid:", "");
}

export function constructFileName({
  cxId,
  patientId,
  metriportId,
  extension,
}: {
  cxId?: string | undefined;
  patientId?: string | undefined;
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
  cxId?: string | undefined;
  patientId?: string | undefined;
  fileName: string;
}): string {
  return `${cxId}/${patientId}/${fileName}`;
}
