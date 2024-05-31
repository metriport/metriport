import { faker } from "@faker-js/faker";
import { Facility, FacilityCreate, USState } from "@metriport/api-sdk";

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
  facilityToCompare?: FacilityCreate | Facility
) => {
  expect(facility.id).toBeTruthy();
  expect(facility.address).toBeTruthy();

  if (facilityToCompare) {
    expect(facility.npi).toEqual(facility.npi);
    expect(facility.address.addressLine1).toEqual(facility.address.addressLine1);
    expect(facility.address.city).toEqual(facility.address.city);
    expect(facility.address.state).toEqual(facility.address.state);
    expect(facility.address.zip).toEqual(facility.address.zip);
    expect(facility.address.country).toEqual(facility.address.country);
    expect(facility.name).toEqual(facility.name);
    expect(facility.active).toEqual(facility.active);
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
