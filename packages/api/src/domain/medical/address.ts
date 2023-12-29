import { USState } from "@metriport/core/domain/geographic-locations";
import { uniqBy } from "lodash";

export type Coordinates = {
  lat: number;
  lon: number;
};

export type Address = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: USState;
  zip: string;
  country?: string;
  coordinates?: Coordinates;
};

/**
 * This function takes two lists of addresses, and combines them into a single list of addresses. It prioritizes the addresses with coordinates and removes duplicates.
 * @param addressList1 - the first list of addresses.
 * @param addressList2 - the second list of addresses.
 * @returns - a list of addresses.
 */
export function combineAddresses(addressList1: Address[], addressList2: Address[]): Address[] {
  const combined = [...addressList1, ...addressList2];

  const compareAddresses = (a: Address, b: Address): number => {
    const aHasCoordinates = a.coordinates ? 1 : 0;
    const bHasCoordinates = b.coordinates ? 1 : 0;
    return bHasCoordinates - aHasCoordinates;
  };
  combined.sort(compareAddresses);

  return uniqBy(combined, a => `${a.addressLine1}-${a.addressLine2}-${a.city}-${a.state}-${a.zip}`);
}

export function getState(address: Address): USState {
  return address.state;
}
