import { Address } from "./address";

// TODO add "coordinates" to AddressStrict as optional
export type AddressStrict = Pick<Address, "addressLine2"> &
  Required<Omit<Address, "addressLine2" | "coordinates">>;

export type AddressWithCoordinates = AddressStrict & { lat: string; lon: string };

export function removeCoordinates(address: AddressWithCoordinates): AddressStrict {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { lat, lon, ...rest } = address;
  return rest;
}
