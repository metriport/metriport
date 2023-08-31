import { OrgType, USState, Organization, OrganizationCreate } from "@metriport/api-sdk";
import { Organization as CWOrganization } from "@metriport/commonwell-sdk";
import { Organization as FhirOrg } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";

export const createOrg: OrganizationCreate = {
  type: OrgType.postAcuteCare,
  name: faker.word.noun(),
  location: {
    addressLine1: "1234 Market St",
    city: "San Francisco",
    state: USState.CA,
    zip: "12345",
    country: "USA",
  },
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateLocalOrg = (org: Organization, orgValidator: any) => {
  expect(org.id).toBeTruthy();
  expect(org.type).toBe(orgValidator.type);
  expect(org.location).toBeTruthy();
  expect(org.name).toBe(orgValidator.name);
  expect(org.oid).toBeTruthy();
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateFhirOrg = (org: FhirOrg, orgValidator: any) => {
  expect(org.resourceType).toBeTruthy();
  expect(org.resourceType).toBe("Organization");
  expect(org.id).toBeTruthy();
  expect(org.name).toBe(orgValidator.name);
  expect(org.address).toBeTruthy();
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateCWOrg = (org: CWOrganization | undefined, orgValidator: any) => {
  expect(org?.organizationId).toBeTruthy();
  expect(org?.name).toBe(orgValidator.name);
  expect(org?.locations).toBeTruthy();
  expect(org?.technicalContacts).toBeTruthy();
  expect(org?.isActive).toBeTruthy();
  expect(org?._links).toBeTruthy();
};
