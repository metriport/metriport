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

  const active = org.isActive;
  if (active == undefined) {
    throw new MetriportError("Missing isActive on CW Org", undefined, {
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

  // Determine organization type based on NPI types or use the type field
  const orgType = org.npiType1 || org.npiType2 || org.type || "Unknown";

  // Determine status based on active state
  const delegateOids = getDelegateOids(org.networks ?? []);

  return {
    id: organizationId,
    organizationName: org.name,
    organizationId,
    orgType,
    memberName: org.memberName,
    addressLine1,
    addressLine2: addressLine2 ?? undefined,
    city,
    state: normalizeUSStateForAddressSafe(state) ?? undefined,
    zipCode: normalizeZipCodeNewSafe(zipCode) ?? undefined,
    country,
    data: org,
    active,
    npi,
    delegateOids,
  };
}

function getDelegateOids(networks: Organization["networks"]): string[] {
  return networks
    .filter(network => network.type.toLowerCase() === "commonwell")
    .flatMap(network => network.doa ?? []);
}
