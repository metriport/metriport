import { USState, FacilityCreate, Facility } from "@metriport/api-sdk";
import { faker } from "@faker-js/faker";

export const createFacility: FacilityCreate = {
  name: faker.word.noun(),
  npi: "2974324529",
  active: true,
  address: {
    addressLine1: faker.location.streetAddress(),
    city: faker.location.city(),
    state: USState.CA,
    zip: faker.location.zipCode("#####"),
    country: "USA",
  },
};

export const validateFacility = (facility: Facility) => {
  expect(facility.id).toBeTruthy();
  expect(facility.npi).toBeTruthy();
  expect(facility.address).toBeTruthy();
  expect(facility.address.addressLine1).toBeTruthy();
  expect(facility.address.city).toBeTruthy();
  expect(facility.address.state).toBeTruthy();
  expect(facility.address.zip).toBeTruthy();
  expect(facility.address.country).toBeTruthy();
  expect(facility.name).toBeTruthy();
  expect(facility.active).toBeTruthy();
};
