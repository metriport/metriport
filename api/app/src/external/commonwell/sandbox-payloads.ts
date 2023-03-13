import { driversLicenseURIs } from "../../shared/oid";

const testOrgId = "1.2.3.4.5.6.7.8.9";
const testPatientId = `${testOrgId}.2.100%5E%5E%5Eurn%3aoid%3a${testOrgId}`;
const testPersonId = "1a2b3c4d-1a2b-1a2b-1a2b-1a2b3c4d5e6f";
const testCWURL = "https://test.rest.api.commonwellalliance.org";
const testCWLabel = "abcd123-1234-dedee-asd9-cnil132uil3n";

export const registerPatient = {
  active: true,
  identifier: [
    {
      use: "usual",
      label: "TestOrg",
      system: `urn:oid:${testOrgId}`,
      key: `${testOrgId}.2.100`,
      assigner: "TestOrg",
    },
    {
      use: "official",
      label: `${testCWLabel}`,
      system: "urn:oid:9.8.7.6.5.4.3.2.1",
      key: `urn:uuid:${testCWLabel}`,
      assigner: "CommonWell",
    },
  ],
  provider: {
    type: "organization",
    reference: `${testCWURL}/v1/org/${testOrgId}/`,
    display: "TestOrg",
  },
  details: {
    address: [
      {
        use: "home",
        line: ["123 sw 16th ave"],
        city: "Miami",
        state: "FL",
        zip: "12345",
      },
      {
        use: "unspecified",
        zip: "12345",
        country: "USA",
      },
    ],
    name: [
      {
        use: "usual",
        family: ["Doe"],
        given: ["John"],
      },
    ],
    gender: {
      code: "M",
    },
    birthDate: "1980-01-01T00:00:00Z",
    identifier: [
      {
        use: "usual",
        system: driversLicenseURIs.FL,
        key: "**********",
      },
    ],
  },
  _links: {
    person: {
      href: `${testCWURL}/v1/person/${testPersonId}`,
    },
    networkLink: {
      href: `${testCWURL}/v1/org/urn%3aoid%3a${testOrgId}/patient/${testPatientId}/networkLink`,
    },
    self: {
      href: `${testCWURL}/v1/org/urn%3aoid%3a${testOrgId}/patient/${testPatientId}/`,
    },
  },
};
