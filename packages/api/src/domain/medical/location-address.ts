import { Address } from "@metriport/core/domain/medical/address";

export type AddressStrict = Pick<Address, "addressLine2"> & Required<Omit<Address, "addressLine2">>;
