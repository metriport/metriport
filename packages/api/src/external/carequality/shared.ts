import { PurposeOfUse } from "@metriport/shared";

// TODO: adjust when we support multiple POUs
export function createPurposeOfUse() {
  return PurposeOfUse.TREATMENT;
}

export function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}
