import { Address } from "../../domain/address";
import { normalizeStateSafe, USState } from "@metriport/shared";
import { AddressMatch } from "./types";

export function getAddressFromMatch({ matchedAddress, addressComponents }: AddressMatch): Address {
  const address = getAddressFromMatchedAddressString(matchedAddress);
  if (address) return address;
  return getAddressFromAddressComponents(addressComponents);
}

function getAddressFromMatchedAddressString(matchedAddress: string): Address | undefined {
  const [addressLine1, city, state, zip] = matchedAddress.split(",");
  const normalizedState = state ? normalizeStateSafe(state) : undefined;
  if (addressLine1 && city && normalizedState && zip) {
    return {
      addressLine1,
      city,
      state: normalizedState,
      zip,
    };
  }
  return undefined;
}

function getAddressFromAddressComponents(
  addressComponents: AddressMatch["addressComponents"]
): Address {
  return {
    addressLine1: addressComponents.fromAddress,
    addressLine2: addressComponents.toAddress,
    city: addressComponents.city,
    state: addressComponents.state as USState,
    zip: addressComponents.zip,
  };
}

export function getStreetFromAddress(address: Address): string {
  if (address.addressLine2) {
    return `${address.addressLine1} ${address.addressLine2}`;
  }
  return address.addressLine1;
}
