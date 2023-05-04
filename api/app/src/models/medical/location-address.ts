import { Address } from "./address";

export type LocationAddress = Pick<Address, "addressLine2"> &
  Required<Omit<Address, "addressLine2">>;
