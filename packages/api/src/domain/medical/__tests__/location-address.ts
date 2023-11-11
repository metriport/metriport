import { fakerEN_US as faker } from "@faker-js/faker";
import { AddressStrict } from "../location-address";
import { USState } from "@metriport/core/domain/geographic-locations";

export const makeAddressStrict = (): AddressStrict => {
  const randomIndex = Math.floor(Math.random() * Object.keys(USState).length);
  return {
    addressLine1: faker.location.streetAddress(),
    zip: faker.location.zipCode(),
    city: faker.location.city(),
    state: Object.values(USState)[randomIndex],
    country: "US",
  };
};
