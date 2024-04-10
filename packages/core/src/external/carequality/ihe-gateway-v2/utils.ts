import { genderMapping } from "../../fhir/patient";

export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (gender === undefined) {
    return undefined;
  }
  return genderMapping[gender];
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
