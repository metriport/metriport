import { Address } from "./address";

// TODO add "coordinates" to AddressStrict as optional
export type AddressStrict = Pick<Address, "addressLine2"> &
  Required<Omit<Address, "addressLine2" | "coordinates">>;
