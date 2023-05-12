import { randCity, randState, randStreetName, randZipCode } from "@ngneat/falso";
import { AddressStrict } from "../location-address";

export const makeAddressStrict = (): AddressStrict => {
  return {
    addressLine1: randStreetName(),
    zip: randZipCode(),
    city: randCity(),
    state: randState(),
    country: "US",
  };
};
