import { faker } from "@faker-js/faker";
import { Practitioner } from "@medplum/fhirtypes";
import { groupSamePractitioners } from "../resources/practitioner";
import {
  exampleAddress,
  makePractitioner,
  practitionerNameZoidberg,
} from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";

let practitionerId: string;
let practitionerId2: string;
let practitioner: Practitioner;
let practitioner2: Practitioner;

beforeEach(() => {
  practitionerId = faker.string.uuid();
  practitionerId2 = faker.string.uuid();
  practitioner = makePractitioner({ id: practitionerId, name: [practitionerNameZoidberg] });
  practitioner2 = makePractitioner({ id: practitionerId2, name: [practitionerNameZoidberg] });
});

describe("groupSamePractitioners", () => {
  it("correctly groups duplicate practitioners based on names and addresses", () => {
    practitioner.address = [exampleAddress];
    practitioner2.address = [exampleAddress];
    const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
    expect(practitionersMap.size).toBe(1);
  });

  it("does not group practitioners with different addresses", () => {
    practitioner.address = [exampleAddress];
    practitioner2.address = [{ ...exampleAddress, city: "New York 3000" }];
    const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
    expect(practitionersMap.size).toBe(2);
  });

  it("does not group practitioners with different names", () => {
    practitioner.address = [exampleAddress];
    practitioner2.address = [exampleAddress];
    practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
    const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
    expect(practitionersMap.size).toBe(2);
  });

  it("removes practitioners without names", () => {
    practitioner.address = [exampleAddress];
    practitioner2.address = [exampleAddress];
    delete practitioner2.name;

    const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
    expect(practitionersMap.size).toBe(1);
  });

  it("removes practitioners without addresses", () => {
    practitioner.address = [exampleAddress];
    const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
    expect(practitionersMap.size).toBe(1);
  });
});
