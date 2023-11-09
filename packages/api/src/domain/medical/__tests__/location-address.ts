import { fakerEN_US as faker } from "@faker-js/faker";
import { AddressStrict } from "../location-address";

export const makeAddressStrict = (): AddressStrict => {
  return {
    addressLine1: faker.location.streetAddress(),
    zip: faker.location.zipCode(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    country: "US",
  };
};
