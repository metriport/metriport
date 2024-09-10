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

describe("Location Deduplication", () => {
  describe("removes locations", () => {
    it("no name and no address", () => {
      delete location2.name;
      const { locationsMap, danglingReferences } = groupSameLocations([location, location2]);
      expect(locationsMap.size).toBe(1);
      expect(danglingReferences.length).toBe(1);
    });
  });

  describe("keeps locations", () => {
    it("no name but has address", () => {
      delete location2.name;
      location2.address = exampleAddress;
      const { locationsMap } = groupSameLocations([location, location2]);
      expect(locationsMap.size).toBe(2);
    });
  });

  describe("Both locations have or don't have address", () => {
    describe("Groups locations when", () => {
      it("same name, no address", () => {
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(1);
      });

      it("same name, same address", () => {
        location.address = exampleAddress;
        location2.address = exampleAddress;
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(1);
      });
    });

    describe("Does not group locations when", () => {
      it("different names, no address", () => {
        location2.name = "Springfield Community Clinic";
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(2);
      });

      it("different names, same address", () => {
        location.address = exampleAddress;
        location2.address = exampleAddress;
        location2.name = "Springfield Community Clinic";
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(2);
      });

      it("same name, different addresses", () => {
        location.address = exampleAddress;
        location2.address = { ...exampleAddress, city: "Shelbyville" };
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(2);
      });
    });
  });

  describe("One location has address and the other doesn't", () => {
    describe("Groups locations when", () => {
      it("same name, one with address, one without", () => {
        location.address = exampleAddress;
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(1);
      });
    });

    describe("Does not group locations when", () => {
      it("different names, one with address, one without", () => {
        location.address = exampleAddress;
        location2.name = "Springfield Community Clinic";
        const { locationsMap } = groupSameLocations([location, location2]);
        expect(locationsMap.size).toBe(2);
      });
    });
  });

  describe("Edge cases", () => {
    it("handles locations with only address, no name", () => {
      delete location.name;
      delete location2.name;
      location.address = exampleAddress;
      location2.address = exampleAddress;
      const { locationsMap, danglingReferences } = groupSameLocations([location, location2]);
      expect(locationsMap.size).toBe(1);
      expect(danglingReferences.length).toBe(0);
    });

    it("handles locations with partial addresses", () => {
      location.name = "Springfield Clinic";
      location2.name = "Springfield Clinic";
      location.address = { city: "Springfield", state: "IL" };
      location2.address = { city: "Springfield", state: "IL" };
      const { locationsMap } = groupSameLocations([location, location2]);
      expect(locationsMap.size).toBe(1);
    });

    it("doesn't group locations with same name but significantly different addresses", () => {
      location.address = exampleAddress;
      location2.address = { ...exampleAddress, line: ["456 Elm St"], postalCode: "62702" };
      const { locationsMap } = groupSameLocations([location, location2]);
      expect(locationsMap.size).toBe(2);
    });
  });
});
