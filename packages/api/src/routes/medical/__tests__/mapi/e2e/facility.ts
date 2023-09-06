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

export const validateFacility = (
  facility: Facility,
  validateFacility?: FacilityCreate | Facility
) => {
  expect(facility.id).toBeTruthy();
  expect(facility.address).toBeTruthy();

  if (validateFacility) {
    expect(facility.npi).toBe(facility.npi);
    expect(facility.address.addressLine1).toBe(facility.address.addressLine1);
    expect(facility.address.city).toBe(facility.address.city);
    expect(facility.address.state).toBe(facility.address.state);
    expect(facility.address.zip).toBe(facility.address.zip);
    expect(facility.address.country).toBe(facility.address.country);
    expect(facility.name).toBe(facility.name);
    expect(facility.active).toBe(facility.active);
  } else {
    expect(facility.npi).toBeTruthy();
    expect(facility.address.addressLine1).toBeTruthy();
    expect(facility.address.city).toBeTruthy();
    expect(facility.address.state).toBeTruthy();
    expect(facility.address.zip).toBeTruthy();
    expect(facility.address.country).toBeTruthy();
    expect(facility.name).toBeTruthy();
    expect(facility.active).toBeTruthy();
  }
};
