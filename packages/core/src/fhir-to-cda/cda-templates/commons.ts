import { Organization, Address } from "@medplum/fhirtypes";
import { withNullFlavor, withNullFlavorObject } from "./utils";

export function constructAddress(address?: Address[]) {
  return address?.map(addr => ({
    ...withNullFlavorObject(addr.use, "@_use"),
    streetAddressLine: withNullFlavor(addr.line?.join(" ")),
    city: withNullFlavor(addr.city),
    state: withNullFlavor(addr.state),
    postalCode: withNullFlavor(addr.postalCode),
    country: withNullFlavor(addr.country),
    useablePeriod: {
      "@_xsi:type": "IVL_TS",
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      low: withNullFlavor(addr.period?.start, "@_value"),
      high: withNullFlavor(addr.period?.end, "@_nullFlavor"),
    },
  }))[0]; // Using only first address
}

export function constructRepresentedOrganization(organization: Organization) {
  return {
    id: organization.identifier?.map(id => ({
      ...withNullFlavorObject(id.system, "@_root"),
      ...withNullFlavorObject(id.value, "@_extension"),
      ...withNullFlavorObject(id.assigner?.display, "@_assigningAuthorityName"),
    })),
    name: withNullFlavor(organization.name),
    telecom: organization.telecom?.map(telecom => ({
      ...withNullFlavorObject(telecom.use, "@_use"),
      ...withNullFlavorObject(telecom.value, "@_value"),
    })),
    addr: constructAddress(organization.address),
  };
}
