import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { exampleAddress } from "../../fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { makeOrganization } from "../../fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { groupSameOrganizations } from "../resources/organization";

let organizationId: string;
let organizationId2: string;
let organization: Organization;
let organization2: Organization;

beforeEach(() => {
  organizationId = faker.string.uuid();
  organizationId2 = faker.string.uuid();
  organization = makeOrganization({ id: organizationId, name: "Planet Express" });
  organization2 = makeOrganization({ id: organizationId2, name: "Planet Express" });
});

describe("groupSameOrganizations", () => {
  it("correctly groups duplicate organizations based on names and addresses", () => {
    organization.address = [exampleAddress];
    organization2.address = [exampleAddress];
    const { organizationsMap } = groupSameOrganizations([organization, organization2]);
    expect(organizationsMap.size).toBe(1);
  });

  it("does not group organizations with different addresses", () => {
    organization.address = [exampleAddress];
    organization2.address = [{ ...exampleAddress, city: "New York 3000" }];
    const { organizationsMap } = groupSameOrganizations([organization, organization2]);
    expect(organizationsMap.size).toBe(2);
  });

  it("does not group organizations with different names", () => {
    organization.address = [exampleAddress];
    organization2.address = [exampleAddress];
    organization2.name = "Zapp Brannigan's Nimbus";
    const { organizationsMap } = groupSameOrganizations([organization, organization2]);
    expect(organizationsMap.size).toBe(2);
  });

  it("removes organizations without names", () => {
    organization.address = [exampleAddress];
    organization2.address = [exampleAddress];
    delete organization2.name;

    const { organizationsMap } = groupSameOrganizations([organization, organization2]);
    expect(organizationsMap.size).toBe(1);
  });

  it("keeps organizations without addresses", () => {
    organization.address = [exampleAddress];
    const { organizationsMap } = groupSameOrganizations([organization, organization2]);
    expect(organizationsMap.size).toBe(2);
  });
});
