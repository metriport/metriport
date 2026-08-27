import { Organization } from "@metriport/commonwell-sdk";
import {
  MetriportError,
  normalizeUSStateForAddressSafe,
  normalizeZipCodeNewSafe,
} from "@metriport/shared";
import stringify from "json-stringify-safe";
import { CwDirectoryEntryData } from "../../cw-directory";

export function parseCWOrganization(org: Organization): CwDirectoryEntryData {
  const organizationId = org.organizationId;
  if (!organizationId) {
    throw new MetriportError("Missing organizationId on CW Org", undefined, {
      org: stringify(org),
    });
  }

  // Get the first location (primary address)
  const location = org.locations?.[0];

  const addressLine1 = location?.address1;
  const addressLine2 = location?.address2;
  const city = location?.city;
  const state = location?.state;
  const zipCode = location?.postalCode;
  const npi = org.npiType1 || org.npiType2 || undefined;
  const orgType = org.type || "Unknown";
  const delegateOids = getDelegateOids(org.networks ?? []);

  return {
    id: organizationId,
    name: org.name,
    oid: organizationId,
    orgType,
    rootOrganization: org.memberName,
    addressLine: getAddressLine(addressLine1, addressLine2),
    city,
    state: (state && normalizeUSStateForAddressSafe(state)) ?? undefined,
    zip: (zipCode && normalizeZipCodeNewSafe(zipCode)) ?? undefined,
    data: org,
    active: org.isActive ?? false,
    npi,
    delegateOids,
  };
}

function getAddressLine(
  addressLine1: string | undefined,
  addressLine2: string | null | undefined
): string {
  if (!addressLine1 && !addressLine2) return "Not specified";
  return [addressLine1, addressLine2].filter(Boolean).join(" ");
}

function getDelegateOids(networks: Organization["networks"]): string[] {
  return networks
    .filter(network => network.type.toLowerCase() === "commonwell")
    .flatMap(network => network.doa ?? []);
}
