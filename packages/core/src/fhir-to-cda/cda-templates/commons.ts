import { Organization, Address, ContactPoint } from "@medplum/fhirtypes";
import {
  withNullFlavor,
  withNullFlavorObject,
  buildInstanceIdentifiersFromIdentifier,
} from "./utils";
import { CDAAddress, CDAOrganization, CDATelecom } from "./types";

export function buildTelecom(telecoms: ContactPoint[] | undefined): CDATelecom[] {
  if (!telecoms) {
    return [];
  }
  return telecoms.map(telecom => ({
    use: withNullFlavorObject(telecom.use, "@_use"),
    value: withNullFlavorObject(telecom.value, "@_value"),
  }));
}

export function buildAddress(address?: Address[]): CDAAddress | undefined {
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

export function buildRepresentedOrganization(
  organization: Organization
): CDAOrganization | undefined {
  return {
    id: buildInstanceIdentifiersFromIdentifier(organization.identifier),
    name: withNullFlavor(organization.name),
    telecom: buildTelecom(organization.telecom),
    addr: buildAddress(organization.address),
  };
}
