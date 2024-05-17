/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { Coordinates } from "@metriport/core/domain/address";
import { USState } from "@metriport/api-sdk";
import { OrgType } from "@metriport/core/domain/organization";
import { AddressWithCoordinates } from "@metriport/core/domain/location-address";

export const getCxOrganizationNameAndOidResult = {
  name: faker.company.name(),
  oid: faker.string.uuid(),
  type: OrgType.acuteCare,
};

export const coordinates: Coordinates = {
  lat: faker.location.latitude(),
  lon: faker.location.longitude(),
};

export const addressWithCoordinates: AddressWithCoordinates = {
  addressLine1: faker.location.streetAddress(),
  addressLine2: faker.location.secondaryAddress(),
  city: faker.location.city(),
  state: USState.CA,
  zip: faker.location.zipCode(),
  country: "USA",
  coordinates,
};
