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
  if (!location) {
    throw new MetriportError("Missing location on CW Org", undefined, {
      org: stringify(org),
    });
  }

  const addressLine1 = location.address1;
  const addressLine2 = location.address2;
  const city = location.city;
  const state = location.state;
  const zipCode = location.postalCode;
  const country = location.country;
  const npi = org.npiType1 || org.npiType2 || undefined;

  if (!addressLine1 || !city || !state || !zipCode || !country) {
    throw new MetriportError("Missing required address fields on CW Org", undefined, {
      org: stringify(org),
    });
  }

  const orgType = org.type || "Unknown";
  const delegateOids = getDelegateOids(org.networks ?? []);

  return {
    id: organizationId,
    name: org.name,
    oid: organizationId,
    orgType,
    rootOrganization: org.memberName,
    addressLine: `${addressLine1} ${addressLine2 ?? ""}`,
    city,
    state: normalizeUSStateForAddressSafe(state) ?? undefined,
    zip: normalizeZipCodeNewSafe(zipCode) ?? undefined,
    data: org,
    active: org.isActive,
    npi,
    delegateOids,
  };
}

function getDelegateOids(networks: Organization["networks"]): string[] {
  return networks
    .filter(network => network.type.toLowerCase() === "commonwell")
    .flatMap(network => network.doa ?? []);
}
