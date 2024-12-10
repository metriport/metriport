import { Organization } from "@metriport/commonwell-sdk";
import { OID_PREFIX } from "@metriport/core/domain/oid";
import { normalizeUSStateForAddress, normalizeZipCodeNew } from "@metriport/shared";
import { CwOrgDetails } from "../../shared";

export function parseCWOrganization(org: Organization): CwOrgDetails {
  const location = org.locations[0];
  if (!location) throw new Error("Location not found");
  return {
    oid: org.organizationId.replace(OID_PREFIX, ""),
    name: org.name,
    data: {
      name: org.name,
      location: {
        addressLine1: location.address1,
        addressLine2: location.address2 ? location.address2 : undefined,
        city: location.city,
        state: normalizeUSStateForAddress(location.state),
        zip: normalizeZipCodeNew(location.postalCode),
        country: location.country,
      },
      type: org.type,
    },
    active: org.isActive,
    isObo: !!org.authorizationInformation,
  };
}
