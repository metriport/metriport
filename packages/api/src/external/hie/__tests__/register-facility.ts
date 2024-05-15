/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { OrgType } from "@metriport/core/domain/organization";
import { USState } from "@metriport/api-sdk";

export const getCxOrganizationNameAndOidResult = {
  name: faker.company.name(),
  oid: faker.string.uuid(),
  type: OrgType.acuteCare,
};

export const addressWithCoordinates = {
  addressLine1: faker.location.streetAddress(),
  addressLine2: faker.location.secondaryAddress(),
  city: faker.location.city(),
  state: USState.CA,
  zip: faker.location.zipCode(),
  country: "USA",
  lat: faker.location.latitude().toString(),
  lon: faker.location.longitude().toString(),
};
