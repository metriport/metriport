import { faker } from "@faker-js/faker";
import { RelatedPerson } from "@medplum/fhirtypes";
import {
  econRelationship,
  makeRelatedPerson,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-family-related-person";
import { groupSameRelatedPersons } from "../resources/related-person";

let relatedPersonId: string;
let relatedPersonId2: string;
let relatedPerson: RelatedPerson;
let relatedPerson2: RelatedPerson;

beforeEach(() => {
  relatedPersonId = faker.string.uuid();
  relatedPersonId2 = faker.string.uuid();
  relatedPerson = makeRelatedPerson({ id: relatedPersonId });
  relatedPerson2 = makeRelatedPerson({ id: relatedPersonId2 });
});

describe("groupSameRelatedPersons", () => {
  it("correctly groups duplicate relatedPersons based on relationship and name", () => {
    relatedPerson.name = [{ given: ["Leela"], family: "Turanga" }];
    relatedPerson2.name = [{ given: ["Leela"], family: "Turanga" }];

    const { relatedPersonsMap } = groupSameRelatedPersons([relatedPerson, relatedPerson2]);
    expect(relatedPersonsMap.size).toBe(1);
  });

  it("correctly groups duplicate relatedPersons even if name is provided in different fields", () => {
    relatedPerson.name = [{ given: ["Leela"], family: "Turanga" }];
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
