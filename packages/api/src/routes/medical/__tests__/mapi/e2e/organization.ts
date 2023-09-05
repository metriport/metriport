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

export const validateLocalOrg = (
  org: Organization,
  validateOrg?: OrganizationCreate | Organization
) => {
  expect(org.id).toBeTruthy();
  expect(org.location).toBeTruthy();
  expect(org.oid).toBeTruthy();

  if (validateOrg) {
    expect(org.type).toBe(validateOrg.type);
    expect(org.name).toBe(validateOrg.name);
    expect(org.location.addressLine1).toBe(validateOrg.location.addressLine1);
    expect(org.location.city).toBe(validateOrg.location.city);
    expect(org.location.state).toBe(validateOrg.location.state);
    expect(org.location.zip).toBe(validateOrg.location.zip);
    expect(org.location.country).toBe(validateOrg.location.country);
  } else {
    expect(org.type).toBeTruthy();
    expect(org.name).toBeTruthy();
    expect(org.location.addressLine1).toBeTruthy();
    expect(org.location.city).toBeTruthy();
    expect(org.location.state).toBeTruthy();
    expect(org.location.zip).toBeTruthy();
    expect(org.location.country).toBeTruthy();
  }
};

export const validateFhirOrg = (org: FhirOrg, validateOrg?: OrganizationCreate | Organization) => {
  expect(org.resourceType).toBeTruthy();
  expect(org.resourceType).toBe("Organization");
  expect(org.id).toBeTruthy();
  expect(org.address).toBeTruthy();
  expect(org.address?.length).toBe(1);

  if (validateOrg) {
    expect(org.name).toBe(validateOrg.name);
    expect(org.address?.[0].line?.[0]).toBe(validateOrg.location.addressLine1);
    expect(org.address?.[0].city).toBe(validateOrg.location.city);
    expect(org.address?.[0].state).toBe(validateOrg.location.state);
    expect(org.address?.[0].postalCode).toBe(validateOrg.location.zip);
    expect(org.address?.[0].country).toBe(validateOrg.location.country);
  } else {
    expect(org.name).toBeTruthy();
    expect(org.address?.[0].line?.[0]).toBeTruthy();
    expect(org.address?.[0].city).toBeTruthy();
    expect(org.address?.[0].state).toBeTruthy();
    expect(org.address?.[0].postalCode).toBeTruthy();
    expect(org.address?.[0].country).toBeTruthy();
  }
};

export const validateCWOrg = (
  org: CWOrganization | undefined,
  validateOrg?: OrganizationCreate | Organization
) => {
  expect(org?.organizationId).toBeTruthy();
  expect(org?.locations).toBeTruthy();
  expect(org?.locations?.length).toBe(1);
  expect(org?.technicalContacts).toBeTruthy();
  expect(org?.isActive).toBeTruthy();
  expect(org?._links).toBeTruthy();

  if (validateOrg) {
    expect(org?.name).toBe(validateOrg.name);
    expect(org?.locations?.[0].address1).toBe(validateOrg.location.addressLine1);
    expect(org?.locations?.[0].city).toBe(validateOrg.location.city);
    expect(org?.locations?.[0].state).toBe(validateOrg.location.state);
    expect(org?.locations?.[0].postalCode).toBe(validateOrg.location.zip);
    expect(org?.locations?.[0].country).toBe(validateOrg.location.country);
  } else {
    expect(org?.name).toBeTruthy();
    expect(org?.locations?.[0].address1).toBeTruthy();
    expect(org?.locations?.[0].city).toBeTruthy();
    expect(org?.locations?.[0].state).toBeTruthy();
    expect(org?.locations?.[0].postalCode).toBeTruthy();
    expect(org?.locations?.[0].country).toBeTruthy();
  }
};
