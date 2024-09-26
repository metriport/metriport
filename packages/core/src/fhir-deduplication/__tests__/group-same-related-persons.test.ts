import { faker } from "@faker-js/faker";
import { RelatedPerson } from "@medplum/fhirtypes";
import {
  econRelationship,
  makeRelatedPerson,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-family-related-person";
import { groupSameRelatedPersons } from "../resources/related-person";
import { exampleAddress } from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";

let relatedPersonId: string;
let relatedPersonId2: string;
let relatedPerson: RelatedPerson;
let relatedPerson2: RelatedPerson;

beforeEach(() => {
  relatedPersonId = faker.string.uuid();
  relatedPersonId2 = faker.string.uuid();
  relatedPerson = makeRelatedPerson({
    id: relatedPersonId,
    name: [{ given: ["Leela"], family: "Turanga" }],
  });
  relatedPerson2 = makeRelatedPerson({
    id: relatedPersonId2,
    name: [{ given: ["Leela"], family: "Turanga" }],
  });
});

describe("groupSameRelatedPersons", () => {
  it("correctly groups duplicate relatedPersons based on relationship and name", () => {
    const { relatedPersonsMap } = groupSameRelatedPersons([relatedPerson, relatedPerson2]);
    expect(relatedPersonsMap.size).toBe(1);
  });

  it("correctly groups duplicate relatedPersons even if name is provided in different fields", () => {
    relatedPerson2.name = [{ text: "LEELA TURANGA" }];

    const { relatedPersonsMap } = groupSameRelatedPersons([relatedPerson, relatedPerson2]);
    expect(relatedPersonsMap.size).toBe(1);
  });

  it("does not group relatedPersons if the relationships are different", () => {
    relatedPerson.name = [{ text: "LEELA TURANGA" }];
    relatedPerson2.name = [{ text: "LEELA TURANGA" }];
    relatedPerson2.relationship = [econRelationship];

    const { relatedPersonsMap } = groupSameRelatedPersons([relatedPerson, relatedPerson2]);
    expect(relatedPersonsMap.size).toBe(2);
  });

  it("does not group relatedPersons if the names are different", () => {
    relatedPerson.name = [{ given: ["John A."], family: "Zoidberg" }];
    relatedPerson2.name = [{ text: "LEELA TURANGA" }];

    const { relatedPersonsMap } = groupSameRelatedPersons([relatedPerson, relatedPerson2]);
    expect(relatedPersonsMap.size).toBe(2);
  });
});
describe("groupSameRelatedPersons", () => {
  it("drops RelatedPerson without relationship", () => {
    const relatedPerson = makeRelatedPerson({ relationship: [] });
    const { relatedPersonsMap, danglingReferences } = groupSameRelatedPersons([relatedPerson]);
    expect(relatedPersonsMap.size).toBe(0);
    expect(danglingReferences.length).toBe(1);
  });

  describe("relationship + name", () => {
    it("groups RelatedPersons with same relationship and name", () => {
      const rp1 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const rp2 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("doesn't group RelatedPersons with same relationship but different names", () => {
      const rp1 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const rp2 = makeRelatedPerson({ name: [{ given: ["Jane"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(2);
    });
  });

  describe("relationship + address", () => {
    it("groups RelatedPersons with same relationship and address", () => {
      const rp1 = makeRelatedPerson({ address: [exampleAddress] });
      const rp2 = makeRelatedPerson({ address: [exampleAddress] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("doesn't group RelatedPersons with same relationship but different addresses", () => {
      const rp1 = makeRelatedPerson({ address: [exampleAddress] });
      const rp2 = makeRelatedPerson({ address: [{ ...exampleAddress, city: "New York" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(2);
    });
  });

  describe("relationship + birthDate", () => {
    it("groups RelatedPersons with same relationship and birthDate", () => {
      const rp1 = makeRelatedPerson({ birthDate: "1990-01-01" });
      const rp2 = makeRelatedPerson({ birthDate: "1990-01-01" });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("doesn't group RelatedPersons with same relationship but different birthDates", () => {
      const rp1 = makeRelatedPerson({ birthDate: "1990-01-01" });
      const rp2 = makeRelatedPerson({ birthDate: "1991-01-01" });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(2);
    });
  });

  describe("combination tests", () => {
    it("groups RelatedPersons with same relationship, name, and address", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
      });
      const rp2 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
      });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("groups RelatedPersons with same relationship and name, different address", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
      });
      const rp2 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [{ ...exampleAddress, city: "New York" }],
      });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("groups RelatedPersons with same relationship, name, and birthDate", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1990-01-01",
      });
      const rp2 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1990-01-01",
      });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("groups RelatedPersons with same relationship and name, different birthDate", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1990-01-01",
      });
      const rp2 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1991-01-01",
      });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });
  });
});

describe("One RelatedPerson has attribute and the other doesn't", () => {
  describe("Groups RelatedPersons when", () => {
    it("same relationship and name, one with address, one without", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
      });
      const rp2 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("same relationship and name, one with birthDate, one without", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1990-01-01",
      });
      const rp2 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });

    it("same relationship and name, one with address and birthDate, one without either", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
        birthDate: "1990-01-01",
      });
      const rp2 = makeRelatedPerson({ name: [{ given: ["John"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(1);
    });
  });

  describe("Does not group RelatedPersons when", () => {
    it("different names, one with address, one without", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        address: [exampleAddress],
      });
      const rp2 = makeRelatedPerson({ name: [{ given: ["Jane"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(2);
    });

    it("different names, one with birthDate, one without", () => {
      const rp1 = makeRelatedPerson({
        name: [{ given: ["John"], family: "Doe" }],
        birthDate: "1990-01-01",
      });
      const rp2 = makeRelatedPerson({ name: [{ given: ["Jane"], family: "Doe" }] });
      const { relatedPersonsMap } = groupSameRelatedPersons([rp1, rp2]);
      expect(relatedPersonsMap.size).toBe(2);
    });
  });
});
