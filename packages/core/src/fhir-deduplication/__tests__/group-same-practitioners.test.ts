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

const validNPI = "1234567893";
const differentValidNPI = "1215394226";

beforeEach(() => {
  practitionerId = faker.string.uuid();
  practitionerId2 = faker.string.uuid();
  practitioner = makePractitioner({ id: practitionerId, name: [practitionerNameZoidberg] });
  practitioner2 = makePractitioner({ id: practitionerId2, name: [practitionerNameZoidberg] });
});

describe("Practitioner Deduplication", () => {
  describe("removes practitioners", () => {
    it("no name and no NPI", () => {
      delete practitioner2.name;
      const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
      expect(practitionersMap.size).toBe(1);
    });

    it("no name or NPI but has address", () => {
      delete practitioner2.name;
      practitioner2.address = [exampleAddress];
      const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
      expect(practitionersMap.size).toBe(1);
    });
  });

  describe("keeps practitioners", () => {
    it("no name but has NPI", () => {
      delete practitioner2.name;
      practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
      const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
      expect(practitionersMap.size).toBe(2);
    });
  });

  describe("Both practitioners have or don't have NPI and address", () => {
    describe("Groups practitioners when", () => {
      it("same name, no NPI, no address", () => {
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same name, same NPI, no address", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same name, no NPI, same address", () => {
        practitioner.address = [exampleAddress];
        practitioner2.address = [exampleAddress];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same name, same NPI, same address", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner.address = [exampleAddress];
        practitioner2.address = [exampleAddress];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same NPI, different names, no address", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same NPI, different names, different addresses", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        practitioner.address = [exampleAddress];
        practitioner2.address = [{ ...exampleAddress, city: "New New York" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });
    });

    describe("Does not group practitioners when", () => {
      it("different names, no NPI, no address", () => {
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });

      it("different names, no NPI, same address", () => {
        practitioner.address = [exampleAddress];
        practitioner2.address = [exampleAddress];
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });

      it("same name, different NPI, no address", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [
          { system: "http://hl7.org/fhir/sid/us-npi", value: differentValidNPI },
        ];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });

      it("same name, no NPI, different address", () => {
        practitioner.address = [exampleAddress];
        practitioner2.address = [{ ...exampleAddress, city: "New New York" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });
    });
  });

  describe("One practitioner has address/NPI and the other doesn't", () => {
    describe("Groups practitioners when", () => {
      it("same name, one with NPI, one without", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same name, one with address, one without", () => {
        practitioner.address = [exampleAddress];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same name, one with NPI and address, one without either", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner.address = [exampleAddress];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });

      it("same NPI, one with address, one without", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner.address = [exampleAddress];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(1);
      });
    });

    describe("Does not group practitioners when", () => {
      it("different names, one with NPI, one without", () => {
        practitioner.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });

      it("different names, one with address, one without", () => {
        practitioner.address = [exampleAddress];
        practitioner2.name = [{ ...practitionerNameZoidberg, family: "Fry" }];
        const { practitionersMap } = groupSamePractitioners([practitioner, practitioner2]);
        expect(practitionersMap.size).toBe(2);
      });
    });
  });
});
