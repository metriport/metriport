import { faker } from "@faker-js/faker";
import { Location } from "@medplum/fhirtypes";
import {
  exampleAddress,
  makeLocation,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { groupSameLocations } from "../resources/location";

let locationId: string;
let locationId2: string;
let location: Location;
let location2: Location;

beforeEach(() => {
  locationId = faker.string.uuid();
  locationId2 = faker.string.uuid();
  location = makeLocation({ id: locationId, name: "Planet Express" });
  location2 = makeLocation({ id: locationId2, name: "Planet Express" });
});

describe("groupSameLocations", () => {
  it("correctly groups duplicate locations based on names and addresses", () => {
    location.address = exampleAddress;
    location2.address = exampleAddress;
    const { locationsMap } = groupSameLocations([location, location2]);
    expect(locationsMap.size).toBe(1);
  });

  it("does not group locations with different addresses", () => {
    location.address = exampleAddress;
    location2.address = { ...exampleAddress, city: "New York 3000" };
    const { locationsMap } = groupSameLocations([location, location2]);
    expect(locationsMap.size).toBe(2);
  });

  it("does not group locations with different names", () => {
    location.address = exampleAddress;
    location2.address = exampleAddress;
    location2.name = "Zapp Brannigan's Nimbus";
    const { locationsMap } = groupSameLocations([location, location2]);
    expect(locationsMap.size).toBe(2);
  });

  it("removes locations without names", () => {
    location.address = exampleAddress;
    location2.address = exampleAddress;
    delete location2.name;

    const { locationsMap } = groupSameLocations([location, location2]);
    expect(locationsMap.size).toBe(1);
  });

  it("removes locations without addresses", () => {
    location.address = exampleAddress;
    const { locationsMap } = groupSameLocations([location, location2]);
    expect(locationsMap.size).toBe(1);
  });
});
