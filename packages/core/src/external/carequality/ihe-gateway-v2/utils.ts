export function normalizeGender(gender: "M" | "F" | undefined): "male" | "female" | undefined {
  if (!gender) return undefined;
  if (gender === "M") {
    return "male";
  } else if (gender === "F") {
    return "female";
  }
  return undefined;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
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
