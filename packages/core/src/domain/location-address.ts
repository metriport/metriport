import { Address } from "./address";

// TODO add "coordinates" to AddressStrict as optional
export type AddressStrict = Pick<Address, "addressLine2"> &
  Required<Omit<Address, "addressLine2" | "coordinates">>;

export type AddressWithCoordinates = AddressStrict & Required<Pick<Address, "coordinates">>;

export function removeCoordinates(address: AddressWithCoordinates): AddressStrict {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { coordinates, ...rest } = address;
  return rest;
}
