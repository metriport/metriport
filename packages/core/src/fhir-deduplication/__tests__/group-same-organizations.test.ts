import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { exampleAddress } from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeOrganization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { groupSameOrganizations } from "../resources/organization";

let organizationId: string;
let organizationId2: string;
let organization: Organization;
let organization2: Organization;

const validNPI = "1234567893";
const differentValidNPI = "1215394226";

beforeEach(() => {
  organizationId = faker.string.uuid();
  organizationId2 = faker.string.uuid();
  organization = makeOrganization({ id: organizationId, name: "Planet Express" });
  organization2 = makeOrganization({ id: organizationId2, name: "Planet Express" });
});

describe("Organization Deduplication", () => {
  describe("removes organizations", () => {
    it("no name and no NPI", () => {
      delete organization2.name;
      const { organizationsMap } = groupSameOrganizations([organization, organization2]);
      expect(organizationsMap.size).toBe(1);
    });

    it("no name or NPI but has address", () => {
      delete organization2.name;
      organization2.address = [exampleAddress];
      const { organizationsMap } = groupSameOrganizations([organization, organization2]);
      expect(organizationsMap.size).toBe(1);
    });
  });

  describe("keeps organizations", () => {
    it("no name but has NPI", () => {
      delete organization2.name;
      organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
      const { organizationsMap } = groupSameOrganizations([organization, organization2]);
      expect(organizationsMap.size).toBe(2);
    });
  });

  describe("Both organizations have or don't have NPI and address", () => {
    describe("Groups organizations when", () => {
      it("same name, no NPI, no address", () => {
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same name, same NPI, no address", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same name, no NPI, same address", () => {
        organization.address = [exampleAddress];
        organization2.address = [exampleAddress];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same name, same NPI, same address", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization.address = [exampleAddress];
        organization2.address = [exampleAddress];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same NPI, different names, no address", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.name = "Zapp Brannigan's Nimbus";
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same NPI, different names, different addresses", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.name = "Zapp Brannigan's Nimbus";
        organization.address = [exampleAddress];
        organization2.address = [{ ...exampleAddress, city: "New New York" }];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });
    });

    describe("Does not group organizations when", () => {
      it("different names, no NPI, no address", () => {
        organization2.name = "Zapp Brannigan's Nimbus";
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });

      it("different names, no NPI, same address", () => {
        organization.address = [exampleAddress];
        organization2.address = [exampleAddress];
        organization2.name = "Zapp Brannigan's Nimbus";
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });

      it("same name, different NPI, no address", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [
          { system: "http://hl7.org/fhir/sid/us-npi", value: differentValidNPI },
        ];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });

      it("same name, no NPI, different address", () => {
        organization.address = [exampleAddress];
        organization2.address = [{ ...exampleAddress, city: "New New York" }];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });
    });
  });

  describe("One organization has address/NPI and the other doesn't", () => {
    describe("Groups organizations when", () => {
      it("same name, one with NPI, one without", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same name, one with address, one without", () => {
        organization.address = [exampleAddress];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same name, one with NPI and address, one without either", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization.address = [exampleAddress];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });

      it("same NPI, one with address, one without", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization.address = [exampleAddress];
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(1);
      });
    });

    describe("Does not group organizations when", () => {
      it("different names, one with NPI, one without", () => {
        organization.identifier = [{ system: "http://hl7.org/fhir/sid/us-npi", value: validNPI }];
        organization2.name = "Zapp Brannigan's Nimbus";
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });

      it("different names, one with address, one without", () => {
        organization.address = [exampleAddress];
        organization2.name = "Zapp Brannigan's Nimbus";
        const { organizationsMap } = groupSameOrganizations([organization, organization2]);
        expect(organizationsMap.size).toBe(2);
      });
    });
  });
});
