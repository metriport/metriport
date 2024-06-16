import { faker } from "@faker-js/faker";
import { Organization as FhirOrg } from "@medplum/fhirtypes";
import { Organization, OrganizationCreate, OrgType, USState } from "@metriport/api-sdk";
import { Organization as CqOrganization } from "@metriport/carequality-sdk";
import { Organization as CWOrganization } from "@metriport/commonwell-sdk";

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
  orgToCompare?: OrganizationCreate | Organization
) => {
  expect(org).toBeTruthy();
  expect(org.id).toBeTruthy();
  expect(org.location).toBeTruthy();
  expect(org.oid).toBeTruthy();

  if (orgToCompare) {
    expect(org.type).toEqual(orgToCompare.type);
    expect(org.name).toEqual(orgToCompare.name);
    expect(org.location.addressLine1).toEqual(orgToCompare.location.addressLine1);
    expect(org.location.city).toEqual(orgToCompare.location.city);
    expect(org.location.state).toEqual(orgToCompare.location.state);
    expect(org.location.zip).toEqual(orgToCompare.location.zip);
    expect(org.location.country).toEqual(orgToCompare.location.country);
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

export const validateFhirOrg = (org: FhirOrg, orgToCompare?: OrganizationCreate | Organization) => {
  expect(org).toBeTruthy();
  expect(org.resourceType).toBeTruthy();
  expect(org.resourceType).toEqual("Organization");
  expect(org.id).toBeTruthy();
  expect(org.address).toBeTruthy();
  expect(org.address?.length).toEqual(1);

  if (orgToCompare) {
    expect(org.name).toEqual(orgToCompare.name);
    expect(org.address?.[0].line?.[0]).toEqual(orgToCompare.location.addressLine1);
    expect(org.address?.[0].city).toEqual(orgToCompare.location.city);
    expect(org.address?.[0].state).toEqual(orgToCompare.location.state);
    expect(org.address?.[0].postalCode).toEqual(orgToCompare.location.zip);
    expect(org.address?.[0].country).toEqual(orgToCompare.location.country);
  } else {
    expect(org.name).toBeTruthy();
    expect(org.address?.[0].line?.[0]).toBeTruthy();
    expect(org.address?.[0].city).toBeTruthy();
    expect(org.address?.[0].state).toBeTruthy();
    expect(org.address?.[0].postalCode).toBeTruthy();
    expect(org.address?.[0].country).toBeTruthy();
  }
};

export function validateCwOrg(
  org: CWOrganization | undefined,
  orgToCompare?: OrganizationCreate | Organization
) {
  expect(org).toBeTruthy();
  expect(org?.organizationId).toBeTruthy();
  expect(org?.locations).toBeTruthy();
  expect(org?.locations?.length).toEqual(1);
  expect(org?.technicalContacts).toBeTruthy();
  expect(org?.isActive).toBeTruthy();
  expect(org?._links).toBeTruthy();

  if (orgToCompare) {
    expect(org?.name).toEqual(orgToCompare.name);
    expect(org?.locations?.[0].address1).toEqual(orgToCompare.location.addressLine1);
    expect(org?.locations?.[0].city).toEqual(orgToCompare.location.city);
    expect(org?.locations?.[0].state).toEqual(orgToCompare.location.state);
    expect(org?.locations?.[0].postalCode).toEqual(orgToCompare.location.zip);
    expect(org?.locations?.[0].country).toEqual(orgToCompare.location.country);
  } else {
    expect(org?.name).toBeTruthy();
    expect(org?.locations?.[0].address1).toBeTruthy();
    expect(org?.locations?.[0].city).toBeTruthy();
    expect(org?.locations?.[0].state).toBeTruthy();
    expect(org?.locations?.[0].postalCode).toBeTruthy();
    expect(org?.locations?.[0].country).toBeTruthy();
  }
}

export function validateCqOrg(
  org: CqOrganization | undefined,
  orgToCompare?: OrganizationCreate | Organization
) {
  expect(org).toBeTruthy();
  expect(org?.identifier.value).toBeTruthy();
  if (orgToCompare) {
    expect(org?.name).toEqual(orgToCompare.name);
    if (`oid` in orgToCompare) {
      expect(org?.identifier.value).toEqual(orgToCompare.oid);
    }
    // TODO 1634 compare addresses
    // TODO 1634 compare addresses
    // TODO 1634 compare addresses
    // TODO 1634 compare addresses
    // TODO 1634 compare addresses
  } else {
    expect(org?.name).toBeTruthy();
  }
}
