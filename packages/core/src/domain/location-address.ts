import { Address } from "./address";

export type AddressStrict = Pick<Address, "addressLine2"> & Required<Omit<Address, "addressLine2">>;
