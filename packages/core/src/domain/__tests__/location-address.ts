import { fakerEN_US as faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import { AddressStrict, AddressWithCoordinates } from "../location-address";

export function makeAddressStrict(params: Partial<AddressStrict> = {}): AddressStrict {
  const randomIndex = Math.floor(Math.random() * Object.keys(USState).length);
  return {
    addressLine1: params.addressLine1 ?? faker.location.streetAddress(),
    ...(params.addressLine2 ? { addressLine2: params.addressLine2 } : {}),
    zip: params.zip ?? faker.location.zipCode("#####"),
    city: params.city ?? faker.location.city(),
    state: params.state ?? Object.values(USState)[randomIndex] ?? USState.CA,
    country: params.country ?? "USA",
  };
}

export function makeAddressWithCoordinates(
  params: Partial<AddressWithCoordinates> = {}
): AddressWithCoordinates {
  return {
    ...makeAddressStrict(params),
    coordinates: {
      lat: params.coordinates?.lat ?? faker.location.latitude(),
      lon: params.coordinates?.lon ?? faker.location.longitude(),
    },
  };
}
