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

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateFacility = (facility: Facility, facilityValidator: any) => {
  expect(facility.id).toBeTruthy();
  expect(facility.npi).toBe(facilityValidator.npi);
  expect(facility.address).toBeTruthy();
  expect(facility.name).toBe(facilityValidator.name);
};
